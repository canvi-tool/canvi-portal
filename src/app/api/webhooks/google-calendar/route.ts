import { NextRequest } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidTokenForUser } from '@/lib/integrations/google-token'
import { runIncrementalSyncForStaff } from '@/lib/integrations/gcal-incremental-sync'

/**
 * Google Calendar Push Notification Webhook
 *
 * Googleカレンダーの変更通知を受信し、該当ユーザーのシフトを即時同期する。
 * Google Calendar API の events.watch で登録したチャンネルに対して呼ばれる。
 *
 * 設計方針（2026-04 最適化）:
 * - syncToken ベースの増分同期のみを行い、平均 <1s で return
 * - shifts の DB 書き込みは runIncrementalSyncForStaff 内で完了する
 * - /shifts ページは Supabase Realtime の postgres_changes で即時に再取得する
 * - 以前あった「events.list → 全件 per-event SELECT/UPDATE」の直列 legacy パスは
 *   4件同時変更時に ~20s かかっていたため削除した。
 */
export async function POST(request: NextRequest) {
  const channelId = request.headers.get('x-goog-channel-id')
  const resourceState = request.headers.get('x-goog-resource-state')
  const resourceId = request.headers.get('x-goog-resource-id')

  console.log(
    `[gcal-webhook] Received: state=${resourceState}, channelId=${channelId}, resourceId=${resourceId}`
  )

  // sync 状態: 初回チャンネル登録確認 → 200を返すだけ
  if (resourceState === 'sync') {
    return new Response(null, { status: 200 })
  }

  // exists / not_exists: イベント変更通知
  if (resourceState !== 'exists' && resourceState !== 'not_exists') {
    console.warn(`[gcal-webhook] Unknown resource state: ${resourceState}`)
    return new Response(null, { status: 200 })
  }

  if (!channelId) {
    return new Response(null, { status: 200 })
  }

  try {
    const admin = createAdminClient()

    // チャンネルID形式: "canvi-gcal-{userId}"
    const userIdMatch = channelId.match(/^canvi-gcal-(.+)$/)
    if (!userIdMatch) {
      console.warn(`[gcal-webhook] Invalid channel ID format: ${channelId}`)
      return new Response(null, { status: 200 })
    }
    const userId = userIdMatch[1]

    const token = await getValidTokenForUser(userId)
    if (!token) {
      console.warn(`[gcal-webhook] No valid token for user ${userId}`)
      return new Response(null, { status: 200 })
    }

    const { data: staffRecord } = await admin
      .from('staff')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (!staffRecord) {
      console.warn(`[gcal-webhook] No active staff for user ${userId}`)
      return new Response(null, { status: 200 })
    }

    // 最速パス: syncToken ベースの増分同期（fire-and-forget で即 200 返却）
    // Vercel の waitUntil でレスポンス後もバックグラウンド実行を継続
    const syncStaffId = staffRecord.id as string
    waitUntil(
      (async () => {
        const t0 = Date.now()
        try {
          const incResult = await runIncrementalSyncForStaff({
            userId,
            staffId: syncStaffId,
          })
          console.log(
            `[gcal-webhook] Incremental sync ${Date.now() - t0}ms (${incResult.mode}): ${incResult.changed} changed, ${incResult.deleted} deleted, errors=${incResult.errors.length}`
          )
        } catch (e) {
          console.error('[gcal-webhook] Incremental sync failed:', e)
        }
      })()
    )

    return new Response(null, { status: 200 })
  } catch (error) {
    console.error('[gcal-webhook] Error processing notification:', error)
    return new Response(null, { status: 200 })
  }
}
