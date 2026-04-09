import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'
import { runIncrementalSyncForStaff } from '@/lib/integrations/gcal-incremental-sync'

/**
 * Google Calendar Push Notification Webhook
 *
 * Googleカレンダーの変更通知を受信し、該当ユーザーのシフトを即時同期する。
 * Google Calendar API の events.watch で登録したチャンネルに対して呼ばれる。
 *
 * Headers:
 * - X-Goog-Channel-ID: チャンネルID（ユーザーIDを含む）
 * - X-Goog-Resource-State: sync | exists | not_exists
 * - X-Goog-Resource-ID: リソースID
 * - X-Goog-Channel-Expiration: チャンネル有効期限
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
    console.log('[gcal-webhook] Channel sync verification received')
    return new Response(null, { status: 200 })
  }

  // exists / not_exists: イベント変更通知
  if (resourceState !== 'exists' && resourceState !== 'not_exists') {
    console.warn(`[gcal-webhook] Unknown resource state: ${resourceState}`)
    return new Response(null, { status: 200 })
  }

  if (!channelId) {
    console.warn('[gcal-webhook] No channel ID in request')
    return new Response(null, { status: 200 })
  }

  try {
    const admin = createAdminClient()

    // チャンネルIDからユーザーIDを特定
    // チャンネルID形式: "canvi-gcal-{userId}"
    const userIdMatch = channelId.match(/^canvi-gcal-(.+)$/)
    if (!userIdMatch) {
      console.warn(`[gcal-webhook] Invalid channel ID format: ${channelId}`)
      return new Response(null, { status: 200 })
    }
    const userId = userIdMatch[1]

    // ユーザーの有効なGoogleトークンを取得
    const token = await getValidTokenForUser(userId)
    if (!token) {
      console.warn(`[gcal-webhook] No valid token for user ${userId}`)
      return new Response(null, { status: 200 })
    }

    // スタッフレコードを取得
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

    // 最速パス: syncToken ベースの増分同期 (平均 <1s)
    // 既に saveしてある syncToken を使って差分だけ取得 → shifts/pending を更新
    // Supabase Realtime で /shifts ページに即時反映される。
    try {
      const incResult = await runIncrementalSyncForStaff({
        userId,
        staffId: staffRecord.id as string,
      })
      console.log(
        `[gcal-webhook] Incremental sync (${incResult.mode}): ${incResult.changed} changed, ${incResult.deleted} deleted, errors=${incResult.errors.length}`
      )
      // 増分同期で主要差分は反映済み。以下の legacy パスはシフト化ルール（project 名マッチ）を
      // 担っているので残すが、ここで早期 return できるケースも将来的に検討可能。
    } catch (e) {
      console.error('[gcal-webhook] Incremental sync failed:', e)
    }

    const client = new GoogleCalendarClient(
      token.accessToken,
      token.refreshToken || undefined
    )

    // プロジェクトアサインメントを取得
    const { data: assignments } = await admin
      .from('project_assignments')
      .select('project_id, projects!inner(id, name, custom_fields)')
      .eq('staff_id', staffRecord.id)
      .in('status', ['active', 'confirmed'])

    if (!assignments || assignments.length === 0) {
      console.warn(`[gcal-webhook] No active assignments for staff ${staffRecord.id}`)
      return new Response(null, { status: 200 })
    }

    const projectMap = new Map<string, string>()
    for (const a of assignments) {
      const project = a.projects as unknown as { id: string; name: string; custom_fields?: Record<string, unknown> | null }
      if (project?.name) {
        projectMap.set(project.name.toLowerCase(), project.id)
        const nameStripped = project.name.toLowerCase().replace(/[（）()\s]/g, '')
        if (nameStripped && nameStripped !== project.name.toLowerCase()) {
          projectMap.set(nameStripped, project.id)
        }
      }
      const displayName = project?.custom_fields?.calendar_display_name as string | undefined
      if (displayName) {
        projectMap.set(displayName.toLowerCase(), project.id)
      }
    }
    const defaultProjectId = assignments[0].project_id

    // 今日と明日のイベントを取得して同期
    const now = new Date()
    const jstOffset = 9 * 60 * 60 * 1000
    const jstNow = new Date(now.getTime() + jstOffset)
    const today = jstNow.toISOString().split('T')[0]
    const dayAfterTomorrow = new Date(jstNow.getTime() + 2 * 24 * 60 * 60 * 1000)
    const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0]

    const timeMin = `${today}T00:00:00+09:00`
    const timeMax = `${dayAfterTomorrowStr}T00:00:00+09:00`

    const events = await client.getEvents('primary', timeMin, timeMax)

    // シフト関連イベントのみフィルタリング
    const shiftEvents = events.filter((event) => {
      if (!event.start.includes('T') || !event.end.includes('T')) return false
      const summary = (event.summary || '').toLowerCase()
      if (summary.includes('シフト')) return true
      for (const [projectName] of projectMap) {
        if (summary.includes(projectName)) return true
      }
      return false
    })

    let created = 0
    let updated = 0

    for (const event of shiftEvents) {
      const { shiftDate, startTime, endTime } = parseEventToJST(event.start, event.end)
      if (!shiftDate || !startTime || !endTime) continue

      const durationMs = new Date(event.end).getTime() - new Date(event.start).getTime()
      const durationHours = durationMs / (1000 * 60 * 60)
      if (durationHours <= 0 || durationHours > 24) continue

      const projectId = matchProjectFromSummary(event.summary, projectMap) || defaultProjectId

      // 既存シフトを検索（google_calendar_event_id または notes の gcal: プレフィックス）
      const { data: existingByEventId } = await admin
        .from('shifts')
        .select('id, shift_date, start_time, end_time, google_meet_url')
        .eq('staff_id', staffRecord.id)
        .eq('google_calendar_event_id', event.id)
        .maybeSingle()

      const { data: existingByNote } = await admin
        .from('shifts')
        .select('id, shift_date, start_time, end_time, google_meet_url')
        .eq('staff_id', staffRecord.id)
        .eq('notes', `gcal:${event.id}`)
        .maybeSingle()

      const existing = existingByEventId || existingByNote

      if (existing) {
        const newMeetUrl = event.meetUrl || null
        if (
          existing.shift_date !== shiftDate ||
          existing.start_time !== startTime ||
          existing.end_time !== endTime ||
          existing.google_meet_url !== newMeetUrl
        ) {
          await admin
            .from('shifts')
            .update({
              shift_date: shiftDate,
              start_time: startTime,
              end_time: endTime,
              project_id: projectId,
              google_meet_url: newMeetUrl,
              google_calendar_synced: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
          updated++
        }
      } else {
        await admin.from('shifts').insert({
          staff_id: staffRecord.id,
          project_id: projectId,
          shift_date: shiftDate,
          start_time: startTime,
          end_time: endTime,
          status: 'APPROVED',
          shift_type: 'WORK',
          google_calendar_event_id: event.id,
          google_calendar_synced: true,
          google_meet_url: event.meetUrl || null,
          notes: `gcal:${event.id}`,
          created_by: userId,
        })
        created++
      }
    }

    console.log(
      `[gcal-webhook] Synced for user ${userId}: ${created} created, ${updated} updated`
    )
  } catch (error) {
    console.error('[gcal-webhook] Error processing notification:', error)
  }

  // Googleは常に200を期待する
  return new Response(null, { status: 200 })
}

function parseEventToJST(
  startStr: string,
  endStr: string
): { shiftDate: string | null; startTime: string | null; endTime: string | null } {
  try {
    const startDate = new Date(startStr)
    const endDate = new Date(endStr)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return { shiftDate: null, startTime: null, endTime: null }
    }
    const jstOffset = 9 * 60 * 60 * 1000
    const jstStart = new Date(startDate.getTime() + jstOffset)
    const jstEnd = new Date(endDate.getTime() + jstOffset)
    const shiftDate = jstStart.toISOString().split('T')[0]
    const startTime = jstStart.toISOString().split('T')[1].slice(0, 5)
    const endTime = jstEnd.toISOString().split('T')[1].slice(0, 5)
    return { shiftDate, startTime, endTime }
  } catch {
    return { shiftDate: null, startTime: null, endTime: null }
  }
}

function matchProjectFromSummary(
  summary: string,
  projectMap: Map<string, string>
): string | null {
  if (!summary) return null
  const lowerSummary = summary.toLowerCase()
  const bracketMatch = summary.match(/\[(.+?)\]/)
  if (bracketMatch) {
    const projectName = bracketMatch[1].toLowerCase()
    const projectId = projectMap.get(projectName)
    if (projectId) return projectId
  }
  for (const [projectName, projectId] of projectMap) {
    if (lowerSummary.includes(projectName)) return projectId
  }
  return null
}
