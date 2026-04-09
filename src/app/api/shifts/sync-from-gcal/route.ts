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
    const sixtyDaysAgo = new Date(jstNow.getTime() - 60 * 24 * 60 * 60 * 1000)
    const today = body.start_date || sixtyDaysAgo.toISOString().split('T')[0]
    const sixtyDaysLater = new Date(jstNow.getTime() + 60 * 24 * 60 * 60 * 1000)
    const endDate = body.end_date || sixtyDaysLater.toISOString().split('T')[0]

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
    let defaultProjectId = ''
    if (assignments) {
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
        if (displayName) projectMap.set(displayName.toLowerCase(), project.id)
      }
      if (assignments.length > 0) defaultProjectId = assignments[0].project_id
    }
    // 他のCanviユーザー発のイベントを除外するための email セットを取得
    const { data: canviUsersAll } = await admin.from('users').select('email, id')
    const canviEmailSet = new Set(
      (canviUsersAll || [])
        .map((u) => (u as { email?: string | null }).email || '')
        .filter((e) => !!e)
        .map((e) => e.toLowerCase())
    )
    const myEmailLower = ((canviUsersAll || []).find((u) => (u as { id?: string }).id === user.id) as { email?: string } | undefined)?.email?.toLowerCase() || ''

    const shiftEvents = events.filter((event) => {
      // 終日イベントは除外
      if (!event.start.includes('T') || !event.end.includes('T')) return false
      // Canvi発(別ユーザー発行)のイベントは除外 (旧互換: 別Canviユーザーがオーガナイザー)
      // 自分自身のCanvi発イベント(event.canviShiftId)は、GCal側で加えられた変更を
      // Canviに取り込むために処理対象とする（下で google_calendar_event_id で既存シフトを更新）
      const org = (event.organizerEmail || '').toLowerCase()
      if (org && org !== myEmailLower && canviEmailSet.has(org)) return false
      return true
    })

    // 既存シフト（google_calendar_event_idあり）を取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingShiftsRes = await (admin.from('shifts') as any)
      .select('id, shift_date, start_time, end_time, google_calendar_event_id, google_meet_url, notes, title, status, source')
      .eq('staff_id', staffRecord.id)
      .gte('shift_date', today)
      .lte('shift_date', endDate)
      .is('deleted_at', null)
      .not('google_calendar_event_id', 'is', null)
    const existingShifts = existingShiftsRes.data as Array<{
      id: string
      shift_date: string
      start_time: string
      end_time: string
      google_calendar_event_id: string | null
      google_meet_url: string | null
      notes: string | null
      title: string | null
      status: string | null
      source: string | null
    }> | null

    // DB の start_time は HH:MM:SS 形式、parseEventToJST は HH:MM 形式 → HH:MM に統一して比較
    const toHHMM = (t: string) => t.slice(0, 5)

    const existingByEventId = new Map<string, { id: string; shift_date: string; start_time: string; end_time: string; google_meet_url: string | null; notes: string | null; title: string | null; source: string | null }>()
    if (existingShifts) {
      for (const shift of existingShifts) {
        if (shift.google_calendar_event_id) {
          existingByEventId.set(shift.google_calendar_event_id, {
            id: shift.id,
            shift_date: shift.shift_date,
            start_time: toHHMM(shift.start_time),
            end_time: toHHMM(shift.end_time),
            google_meet_url: shift.google_meet_url || null,
            notes: shift.notes || null,
            title: shift.title || null,
            source: shift.source || null,
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

      const newDescription = event.description || null
      const newMeetUrl = event.meetUrl || null

      if (existing) {
        // GCal側で時刻/Meet URL/説明/タイトルが変更された場合、Canviシフトを更新
        const cleanExistingNotes = existing.notes && existing.notes.startsWith('gcal:') ? null : existing.notes
        const newTitle = event.summary || null
        if (
          existing.shift_date !== shiftDate ||
          existing.start_time !== startTime ||
          existing.end_time !== endTime ||
          existing.google_meet_url !== newMeetUrl ||
          cleanExistingNotes !== newDescription ||
          (existing.title || null) !== newTitle
        ) {
          await admin.from('shifts').update({
            shift_date: shiftDate,
            start_time: startTime,
            end_time: endTime,
            title: newTitle,
            google_meet_url: newMeetUrl,
            notes: newDescription,
            google_calendar_synced: true,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id)
          updated++
        }
      } else if (event.canviShiftId) {
        // Canvi発イベントだが既存shiftが google_calendar_event_id で見つからない
        // → canviShiftId から直接引いて更新 (ev.id と DB 側 google_calendar_event_id が
        //    ずれた旧データ救済)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: canviShiftList } = await (admin.from('shifts') as any)
          .select('id, shift_date, start_time, end_time, title, notes, google_meet_url')
          .eq('id', event.canviShiftId)
          .is('deleted_at', null)
          .limit(1) as { data: Array<{ id: string; shift_date: string; start_time: string; end_time: string; title: string | null; notes: string | null; google_meet_url: string | null }> | null }
        const canviShift = canviShiftList && canviShiftList[0]
        if (canviShift) {
          const curStart = (canviShift.start_time || '').slice(0, 5)
          const curEnd = (canviShift.end_time || '').slice(0, 5)
          const newTitle = event.summary || null
          const cleanNotes = canviShift.notes && canviShift.notes.startsWith('gcal:') ? null : canviShift.notes
          if (
            canviShift.shift_date !== shiftDate ||
            curStart !== startTime ||
            curEnd !== endTime ||
            (canviShift.title || null) !== newTitle ||
            cleanNotes !== newDescription ||
            (canviShift.google_meet_url || null) !== newMeetUrl
          ) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (admin.from('shifts') as any).update({
              shift_date: shiftDate,
              start_time: startTime,
              end_time: endTime,
              title: newTitle,
              notes: newDescription,
              google_meet_url: newMeetUrl,
              google_calendar_event_id: event.id,
              external_event_id: event.id,
              google_calendar_synced: true,
              updated_at: new Date().toISOString(),
            }).eq('id', canviShift.id)
            updated++
          } else {
            // 差分なしでも external_event_id が未設定なら埋める
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (admin.from('shifts') as any)
              .update({ external_event_id: event.id, google_calendar_event_id: event.id })
              .eq('id', canviShift.id)
              .is('external_event_id', null)
          }
        }
        // canviShiftId を持つ Canvi 発イベントは決して新規 INSERT しない
        continue
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
          google_meet_url: newMeetUrl,
          notes: newDescription,
          created_by: user.id,
        })
        created++
      } else {
        // デフォルトプロジェクトがない → ログだけ残してスキップ
        console.warn(`[sync-from-gcal] No default project for staff ${staffRecord.id}, skipping event ${event.id}`)
      }
    }

    // GCalから削除されたイベントの検知
    // Canvi発(source != 'google_calendar')のシフトは Canvi が正なのでGCal不在だけで削除しない。
    // GCal発(source='google_calendar')のシフトのみ getEventById で実在を確認してから soft-delete する。
    if (existingShifts) {
      for (const shift of existingShifts) {
        if (!shift.google_calendar_event_id) continue
        if (processedEventIds.has(shift.google_calendar_event_id)) continue
        if ((shift as { source?: string | null }).source !== 'google_calendar') continue

        let gone = false
        try {
          const ev = await client.getEventById('primary', shift.google_calendar_event_id)
          gone = ev === null
        } catch {
          continue
        }
        if (!gone) continue

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
