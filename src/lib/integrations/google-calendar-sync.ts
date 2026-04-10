import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from './google-calendar'
import { getValidTokenForUser } from './google-token'

/**
 * シフトをGoogleカレンダーに同期する（APPROVED時に呼ばれる）
 * - 新規: イベント作成 + Meet URL発行 + google_calendar_event_id保存
 * - 更新: 既存イベントのパッチ
 */
export async function syncShiftToCalendar(shiftId: string): Promise<void> {
  try {
    const admin = createAdminClient()

    const { data: shiftRaw } = await admin
      .from('shifts')
      .select(`
        id, staff_id, project_id, shift_date, start_time, end_time,
        shift_type, title, notes, attendees, google_calendar_event_id,
        staff!inner(user_id, last_name, first_name),
        projects(name, custom_fields)
      `)
      .eq('id', shiftId)
      .single()

    if (!shiftRaw) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shift = shiftRaw as any

    const staffData = shift.staff as unknown as { user_id: string; last_name: string; first_name: string }
    const projectData = (shift.projects as unknown as { name: string; custom_fields: Record<string, unknown> | null } | null) || { name: '個人予定', custom_fields: null }
    const userId = staffData.user_id
    if (!userId) return

    const token = await getValidTokenForUser(userId)
    if (!token) {
      console.warn(`No valid Google token for user ${userId}, skipping calendar sync`)
      return
    }

    const client = await GoogleCalendarClient.create(token.accessToken, token.refreshToken || undefined)

    // start_time is "HH:MM" or "HH:MM:SS" from DB — normalize to HH:MM:SS
    const normalizeTime = (t: string) => t.length === 5 ? `${t}:00` : t.slice(0, 8)
    const startDateTime = `${shift.shift_date}T${normalizeTime(shift.start_time)}+09:00`
    const endDateTime = `${shift.shift_date}T${normalizeTime(shift.end_time)}+09:00`
    const calendarDisplayName = projectData.custom_fields?.calendar_display_name as string | undefined
    const summary = (shift.title as string | null) || calendarDisplayName || projectData.name
    const description = shift.notes || undefined
    const attendeeEmails = Array.isArray(shift.attendees)
      ? (shift.attendees as Array<{ email?: string }>).map(a => a?.email).filter((e): e is string => !!e)
      : []

    console.log(`[syncShiftToCalendar] shiftId=${shiftId} eventId=${shift.google_calendar_event_id || 'NEW'} attendees=${JSON.stringify(attendeeEmails)} rawAttendees=${JSON.stringify(shift.attendees)}`)

    if (shift.google_calendar_event_id) {
      // 既存イベント更新
      await client.updateEvent({
        eventId: shift.google_calendar_event_id,
        summary,
        description,
        startDateTime,
        endDateTime,
        attendees: attendeeEmails,
      })

      // 同期フラグを最新に保つ
      await admin.from('shifts').update({
        google_calendar_synced: true,
      }).eq('id', shiftId)
    } else {
      // 新規イベント作成 + Meet URL
      const { eventId, meetUrl } = await client.createEvent({
        summary,
        description,
        startDateTime,
        endDateTime,
        withMeet: true,
        attendees: attendeeEmails,
        canviShiftId: shiftId,
      })

      // DB更新: event_id + meet_url保存
      // external_event_id も同時に set することで、webhook 由来の増分同期が
      // 「同じイベント」として認識でき、重複 INSERT を防ぐ。
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('shifts') as any).update({
        google_calendar_event_id: eventId,
        external_event_id: eventId,
        google_meet_url: meetUrl,
        google_calendar_synced: true,
      }).eq('id', shiftId)
    }
  } catch (error) {
    console.error('syncShiftToCalendar error:', shiftId, error)
  }
}

/**
 * シフト削除時にGoogleカレンダーからイベントを削除する
 */
export async function deleteShiftFromCalendar(shiftId: string, options: { notifyAttendees?: boolean } = {}): Promise<void> {
  try {
    const admin = createAdminClient()

    const { data: shift } = await admin
      .from('shifts')
      .select(`
        id, google_calendar_event_id,
        staff!inner(user_id)
      `)
      .eq('id', shiftId)
      .single()

    if (!shift?.google_calendar_event_id) return

    const staffData = shift.staff as unknown as { user_id: string }
    const userId = staffData.user_id
    if (!userId) return

    const token = await getValidTokenForUser(userId)
    if (!token) return

    const client = await GoogleCalendarClient.create(token.accessToken, token.refreshToken || undefined)
    await client.deleteEvent('primary', shift.google_calendar_event_id, { notifyAttendees: !!options.notifyAttendees })

    // GCalイベントIDをクリア（再提出時に新規イベント作成されるように）
    await admin.from('shifts').update({
      google_calendar_event_id: null,
      google_meet_url: null,
      google_calendar_synced: false,
    }).eq('id', shiftId)
  } catch (error) {
    console.error('deleteShiftFromCalendar error:', shiftId, error)
  }
}
