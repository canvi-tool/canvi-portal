import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'

/**
 * POST /api/shifts/sync-from-gcal
 * ログインユーザーのGoogleカレンダー変更をCanviシフトに反映する（オンデマンド同期）
 *
 * Body: { start_date?: string, end_date?: string }
 * デフォルト: 今日から2週間
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const admin = createAdminClient()

    // スタッフレコードを取得
    const { data: staffRecord } = await admin
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!staffRecord) {
      return NextResponse.json({ error: 'スタッフ情報がありません' }, { status: 404 })
    }

    // Googleトークンを取得
    const token = await getValidTokenForUser(user.id)
    if (!token) {
      return NextResponse.json({ error: 'Googleカレンダーが未連携です' }, { status: 400 })
    }

    const client = new GoogleCalendarClient(token.accessToken, token.refreshToken || undefined)

    // 日付範囲の計算
    const jstOffset = 9 * 60 * 60 * 1000
    const jstNow = new Date(Date.now() + jstOffset)
    const today = body.start_date || jstNow.toISOString().split('T')[0]
    const twoWeeksLater = new Date(jstNow.getTime() + 14 * 24 * 60 * 60 * 1000)
    const endDate = body.end_date || twoWeeksLater.toISOString().split('T')[0]

    const timeMin = `${today}T00:00:00+09:00`
    const timeMax = `${endDate}T23:59:59+09:00`

    // GCalからイベントを取得
    const events = await client.getEvents('primary', timeMin, timeMax)

    // プロジェクトアサインメントを取得
    const { data: assignments } = await admin
      .from('project_assignments')
      .select('project_id, projects!inner(id, name, custom_fields)')
      .eq('staff_id', staffRecord.id)
      .in('status', ['active', 'confirmed'])

    const projectMap = new Map<string, string>()
    const calendarDisplayNames = new Set<string>()
    let defaultProjectId = ''
    if (assignments) {
      for (const a of assignments) {
        const project = a.projects as unknown as { id: string; name: string; custom_fields?: Record<string, unknown> | null }
        if (project?.name) projectMap.set(project.name.toLowerCase(), project.id)
        const displayName = project?.custom_fields?.calendar_display_name as string | undefined
        if (displayName) calendarDisplayNames.add(displayName.toLowerCase())
      }
      if (assignments.length > 0) defaultProjectId = assignments[0].project_id
    }

    // シフト関連イベントのみフィルタリング
    const shiftEvents = events.filter((event) => {
      if (!event.start.includes('T') || !event.end.includes('T')) return false
      const summary = (event.summary || '').toLowerCase()
      if (summary.includes('シフト')) return true
      for (const [projectName] of projectMap) {
        if (summary.includes(projectName)) return true
      }
      for (const displayName of calendarDisplayNames) {
        if (summary.includes(displayName)) return true
      }
      return false
    })

    // 既存シフト（google_calendar_event_idあり）を取得
    const { data: existingShifts } = await admin
      .from('shifts')
      .select('id, shift_date, start_time, end_time, google_calendar_event_id, google_meet_url, notes, status')
      .eq('staff_id', staffRecord.id)
      .gte('shift_date', today)
      .lte('shift_date', endDate)
      .is('deleted_at', null)
      .not('google_calendar_event_id', 'is', null)

    // DB の start_time は HH:MM:SS 形式、parseEventToJST は HH:MM 形式 → HH:MM に統一して比較
    const toHHMM = (t: string) => t.slice(0, 5)

    const existingByEventId = new Map<string, { id: string; shift_date: string; start_time: string; end_time: string; google_meet_url: string | null }>()
    if (existingShifts) {
      for (const shift of existingShifts) {
        if (shift.google_calendar_event_id) {
          existingByEventId.set(shift.google_calendar_event_id, {
            id: shift.id,
            shift_date: shift.shift_date,
            start_time: toHHMM(shift.start_time),
            end_time: toHHMM(shift.end_time),
            google_meet_url: shift.google_meet_url || null,
          })
        }
      }
    }

    const processedEventIds = new Set<string>()
    let created = 0
    let updated = 0
    let deleted = 0

    for (const event of shiftEvents) {
      processedEventIds.add(event.id)

      const { shiftDate, startTime, endTime } = parseEventToJST(event.start, event.end)
      if (!shiftDate || !startTime || !endTime) continue

      const durationMs = new Date(event.end).getTime() - new Date(event.start).getTime()
      if (durationMs <= 0 || durationMs > 24 * 60 * 60 * 1000) continue

      const projectId = matchProjectFromSummary(event.summary, projectMap) || defaultProjectId

      const existing = existingByEventId.get(event.id)

      if (existing) {
        // GCal側で時刻またはMeet URLが変更された場合、Canviシフトを更新
        const newMeetUrl = event.meetUrl || null
        if (existing.shift_date !== shiftDate || existing.start_time !== startTime || existing.end_time !== endTime || existing.google_meet_url !== newMeetUrl) {
          await admin.from('shifts').update({
            shift_date: shiftDate,
            start_time: startTime,
            end_time: endTime,
            google_meet_url: newMeetUrl,
            google_calendar_synced: true,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id)
          updated++
        }
      } else if (defaultProjectId) {
        // GCalにあるがCanviにない → 新規作成
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
          created_by: user.id,
        })
        created++
      }
    }

    // GCalから削除されたイベントの検知
    if (existingShifts) {
      for (const shift of existingShifts) {
        if (!shift.google_calendar_event_id) continue
        if (processedEventIds.has(shift.google_calendar_event_id)) continue

        // Canviで作成してGCalに同期したシフトがGCalから削除された → ソフト削除
        const nowIso = new Date().toISOString()
        await admin.from('shifts').update({
          deleted_at: nowIso,
          updated_at: nowIso,
        }).eq('id', shift.id)
        deleted++
      }
    }

    return NextResponse.json({
      message: `同期完了: ${created}件作成, ${updated}件更新, ${deleted}件GCal削除検知`,
      created,
      updated,
      deleted,
      total_gcal_events: shiftEvents.length,
    })
  } catch (error) {
    console.error('POST /api/shifts/sync-from-gcal error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

function parseEventToJST(startStr: string, endStr: string) {
  try {
    const startDate = new Date(startStr)
    const endDate = new Date(endStr)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return { shiftDate: null, startTime: null, endTime: null }
    }
    const jstOffset = 9 * 60 * 60 * 1000
    const jstStart = new Date(startDate.getTime() + jstOffset)
    const jstEnd = new Date(endDate.getTime() + jstOffset)
    return {
      shiftDate: jstStart.toISOString().split('T')[0],
      startTime: jstStart.toISOString().split('T')[1].slice(0, 5),
      endTime: jstEnd.toISOString().split('T')[1].slice(0, 5),
    }
  } catch {
    return { shiftDate: null, startTime: null, endTime: null }
  }
}

function matchProjectFromSummary(summary: string, projectMap: Map<string, string>): string | null {
  if (!summary) return null
  const lowerSummary = summary.toLowerCase()
  const bracketMatch = summary.match(/\[(.+?)\]/)
  if (bracketMatch) {
    const projectId = projectMap.get(bracketMatch[1].toLowerCase())
    if (projectId) return projectId
  }
  for (const [projectName, projectId] of projectMap) {
    if (lowerSummary.includes(projectName)) return projectId
  }
  return null
}
