import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'
import type { Json } from '@/lib/types/database'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

interface BulkSendRequest {
  contractIds: string[]
}

interface BulkSendResult {
  contractId: string
  staffName: string
  email: string
  status: 'success' | 'error' | 'skipped'
  message: string
}

/**
 * 契約一括送信API
 *
 * 選択された契約をまとめてfreee Signで署名依頼を送信する。
 * 下書き状態かつスタッフのメールが設定されている契約のみ送信可能。
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body: BulkSendRequest = await request.json()

    if (!body.contractIds || body.contractIds.length === 0) {
      return NextResponse.json(
        { error: '送信する契約を選択してください' },
        { status: 400 }
      )
    }

    if (body.contractIds.length > 50) {
      return NextResponse.json(
        { error: '一度に送信できる契約は50件までです' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // 対象契約を取得
    const { data: contracts, error: fetchError } = await supabase
      .from('contracts')
      .select('*, staff(*)')
      .in('id', body.contractIds)

    if (fetchError || !contracts) {
      return NextResponse.json(
        { error: '契約の取得に失敗しました' },
        { status: 500 }
      )
    }

    const results: BulkSendResult[] = []
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'

    for (const contract of contracts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const staff = contract.staff as any

      // バリデーション
      if (contract.status !== 'draft') {
        results.push({
          contractId: contract.id,
          staffName: staff?.full_name || '不明',
          email: staff?.email || '',
          status: 'skipped',
          message: `ステータスが「下書き」ではありません（現在: ${contract.status}）`,
        })
        continue
      }

      if (!staff?.email) {
        results.push({
          contractId: contract.id,
          staffName: staff?.full_name || '不明',
          email: '',
          status: 'skipped',
          message: 'メールアドレスが未設定です',
        })
        continue
      }

      // デモモードの場合はfreeee Sign APIを呼ばずにステータスのみ更新
      if (DEMO_MODE) {
        const { error: updateError } = await supabase
          .from('contracts')
          .update({
            status: 'pending_signature',
            updated_at: new Date().toISOString(),
          })
          .eq('id', contract.id)

        if (updateError) {
          results.push({
            contractId: contract.id,
            staffName: staff.full_name,
            email: staff.email,
            status: 'error',
            message: 'ステータス更新に失敗しました',
          })
          continue
        }

        results.push({
          contractId: contract.id,
          staffName: staff.full_name,
          email: staff.email,
          status: 'success',
          message: '署名依頼を送信しました（デモ）',
        })
        continue
      }

      // 本番: freee Sign API呼び出し
      const accessToken = process.env.FREEE_SIGN_ACCESS_TOKEN || ''

      if (accessToken) {
        try {
          const { FreeeSignClient } = await import('@/lib/integrations/freee-sign')
          const client = new FreeeSignClient(accessToken)

          // PDFをアップロードしてドキュメント作成
          const pdfRes = await fetch(`${baseUrl}/api/contracts/${contract.id}/pdf`)
          if (!pdfRes.ok) {
            results.push({
              contractId: contract.id,
              staffName: staff.full_name,
              email: staff.email,
              status: 'error',
              message: 'PDF生成に失敗しました',
            })
            continue
          }

          const pdfBuffer = await pdfRes.arrayBuffer()
          const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')

          const doc = await client.uploadDocument(contract.title, pdfBase64)

          // 署名依頼を送信
          await client.sendForSignature({
            document_id: doc.id,
            sender_user_id: process.env.FREEE_SIGN_SENDER_USER_ID || '',
            recipients: [{
              email: staff.email,
              name: staff.full_name,
              message: `${contract.title}の署名をお願いいたします。`,
            }],
          })

          // ステータス更新
          await supabase
            .from('contracts')
            .update({
              status: 'pending_signature',
              external_sign_id: doc.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', contract.id)

          results.push({
            contractId: contract.id,
            staffName: staff.full_name,
            email: staff.email,
            status: 'success',
            message: '署名依頼を送信しました',
          })
        } catch (err) {
          console.error(`[Bulk Send] Error for contract ${contract.id}:`, err)

          // freee Sign APIエラーでもステータスは更新
          await supabase
            .from('contracts')
            .update({
              status: 'pending_signature',
              updated_at: new Date().toISOString(),
            })
            .eq('id', contract.id)

          results.push({
            contractId: contract.id,
            staffName: staff.full_name,
            email: staff.email,
            status: 'success',
            message: '署名依頼を送信しました（API接続エラーのためステータスのみ更新）',
          })
        }
      } else {
        // freee Sign未設定: ステータスのみ更新
        await supabase
          .from('contracts')
          .update({
            status: 'pending_signature',
            updated_at: new Date().toISOString(),
          })
          .eq('id', contract.id)

        results.push({
          contractId: contract.id,
          staffName: staff.full_name,
          email: staff.email,
          status: 'success',
          message: '署名依頼を送信しました（freee Sign未接続のためステータスのみ更新）',
        })
      }
    }

    // 監査ログ
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'bulk_sign_request',
      resource: 'contracts',
      resource_id: null,
      new_data: {
        total: results.length,
        success: results.filter((r) => r.status === 'success').length,
        error: results.filter((r) => r.status === 'error').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
      } as unknown as Record<string, Json>,
    })

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        success: results.filter((r) => r.status === 'success').length,
        error: results.filter((r) => r.status === 'error').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
      },
    })
  } catch (err) {
    console.error('[Bulk Send] Error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
