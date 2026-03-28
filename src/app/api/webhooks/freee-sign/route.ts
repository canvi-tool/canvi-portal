import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  verifyWebhookSignature,
  mapFreeeSignStatusToContractStatus,
  type FreeeSignWebhookPayload,
} from '@/lib/integrations/freee-sign'

/**
 * freee Sign Webhook受信エンドポイント
 *
 * freee Signからドキュメントステータス変更通知を受信し、
 * 契約テーブルのステータスを自動更新する。
 *
 * Headers:
 *   X-NinjaSign-Signature: sha256=<hmac_hex>
 *   X-NinjaSign-Trigger: document_status_changed | post_test
 *   X-NinjaSign-RequestId: <uuid>
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('X-NinjaSign-Signature') || ''
    const trigger = request.headers.get('X-NinjaSign-Trigger') || ''
    const requestId = request.headers.get('X-NinjaSign-RequestId') || ''

    // 署名検証
    if (process.env.FREEE_SIGN_WEBHOOK_SECRET) {
      if (!verifyWebhookSignature(rawBody, signature)) {
        console.error('[Webhook] Invalid signature', { requestId })
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload: FreeeSignWebhookPayload = JSON.parse(rawBody)

    // テスト通知
    if (trigger === 'post_test' || payload.trigger === 'post_test') {
      console.log('[Webhook] Test received:', payload.message)
      return NextResponse.json({ status: 'ok', message: 'Test webhook received' })
    }

    // ドキュメントステータス変更
    if (payload.trigger === 'document_status_changed' && payload.document) {
      const { id: freeeDocId, status: newFreeeStatus, title } = payload.document

      console.log(`[Webhook] Document status changed: ${freeeDocId} → ${newFreeeStatus} (${title})`)

      const contractStatus = mapFreeeSignStatusToContractStatus(newFreeeStatus)
      if (!contractStatus) {
        console.log(`[Webhook] Unmapped status: ${newFreeeStatus}, skipping`)
        return NextResponse.json({ status: 'ok', message: 'Status not mapped' })
      }

      const supabase = createAdminClient()

      // external_sign_idで契約を検索
      const { data: contract, error: findError } = await supabase
        .from('contracts')
        .select('id, status')
        .eq('external_sign_id', freeeDocId)
        .single()

      if (findError || !contract) {
        console.warn(`[Webhook] Contract not found for freee doc: ${freeeDocId}`)
        return NextResponse.json({ status: 'ok', message: 'Contract not found' })
      }

      // 同じステータスなら更新不要
      if (contract.status === contractStatus) {
        return NextResponse.json({ status: 'ok', message: 'Status unchanged' })
      }

      // ステータス更新
      const updateData: Record<string, unknown> = {
        status: contractStatus,
        updated_at: new Date().toISOString(),
      }
      if (contractStatus === 'signed') {
        updateData.signed_at = new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('contracts')
        .update(updateData)
        .eq('id', contract.id)

      if (updateError) {
        console.error('[Webhook] Failed to update contract:', updateError)
        return NextResponse.json({ error: 'Update failed' }, { status: 500 })
      }

      // 監査ログ
      await supabase.from('audit_logs').insert({
        user_id: null,
        action: 'webhook_status_update',
        resource: 'contracts',
        resource_id: contract.id,
        new_data: {
          freee_sign_doc_id: freeeDocId,
          freee_sign_status: newFreeeStatus,
          contract_status: contractStatus,
          webhook_request_id: requestId,
        },
      })

      console.log(`[Webhook] Contract ${contract.id} updated: ${contract.status} → ${contractStatus}`)
      return NextResponse.json({ status: 'ok', contractId: contract.id, newStatus: contractStatus })
    }

    return NextResponse.json({ status: 'ok', message: 'Event processed' })
  } catch (err) {
    console.error('[Webhook] Error processing webhook:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
