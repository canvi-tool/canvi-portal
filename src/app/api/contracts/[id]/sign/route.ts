import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'
import { FreeeSignClient, FreeeSignApiError } from '@/lib/integrations/freee-sign'
import type { Json } from '@/lib/types/database'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createServerSupabaseClient()

    // Get contract with staff info
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('*, staff(*)')
      .eq('id', id)
      .single()

    if (fetchError || !contract) {
      return NextResponse.json(
        { error: '契約が見つかりません' },
        { status: 404 }
      )
    }

    if (contract.status !== 'draft') {
      return NextResponse.json(
        { error: '下書き状態の契約のみ署名依頼を送信できます' },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const staff = contract.staff as any

    if (!staff?.email) {
      return NextResponse.json(
        { error: 'スタッフのメールアドレスが設定されていません' },
        { status: 400 }
      )
    }

    // Generate PDF URL for freee Sign (using our own PDF endpoint)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const pdfUrl = `${baseUrl}/api/contracts/${id}/pdf`

    // Send to freee Sign
    const freeeSign = new FreeeSignClient()

    let freeeSignDocumentId: string | null = null

    try {
      const document = await freeeSign.sendDocument({
        title: contract.title,
        signerName: staff.full_name,
        signerEmail: staff.email,
        pdfUrl,
        message: `${contract.title}の署名をお願いいたします。内容をご確認の上、電子署名をお願いいたします。`,
        callbackUrl: `${baseUrl}/api/contracts/${id}/sign/callback`,
      })
      freeeSignDocumentId = document.id
    } catch (err) {
      if (err instanceof FreeeSignApiError) {
        console.error('freee Sign API error:', err.code, err.message)
        // If freee Sign is not configured, still update the status
        // but log the error
        if (err.statusCode === 0) {
          console.warn('freee Sign API not configured, updating status only')
        } else {
          return NextResponse.json(
            { error: `freee Sign エラー: ${err.message}` },
            { status: 502 }
          )
        }
      } else {
        console.warn('freee Sign send failed, updating status only:', err)
      }
    }

    // Update contract status to pending_signature
    const updateData: Record<string, unknown> = {
      status: 'pending_signature',
      updated_at: new Date().toISOString(),
    }
    if (freeeSignDocumentId) {
      updateData.external_sign_id = freeeSignDocumentId
    }

    const { data: updatedContract, error: updateError } = await supabase
      .from('contracts')
      .update(updateData)
      .eq('id', id)
      .select('*, staff(*), template:contract_templates(*)')
      .single()

    if (updateError) {
      console.error('Contract status update error:', updateError)
      return NextResponse.json(
        { error: '契約ステータスの更新に失敗しました' },
        { status: 500 }
      )
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'sign_request',
      resource: 'contracts',
      resource_id: id,
      new_data: {
        status: 'pending_signature',
        external_sign_id: freeeSignDocumentId,
      } as unknown as Record<string, Json>,
    })

    return NextResponse.json(updatedContract)
  } catch (err) {
    console.error('Contract sign error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
