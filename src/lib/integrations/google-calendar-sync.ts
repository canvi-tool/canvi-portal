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

    const { data: shift } = await admin
      .from('shifts')
      .select(`
        id, staff_id, project_id, shift_date, start_time, end_time,
        shift_type, notes, google_calendar_event_id,
        staff!inner(user_id, display_name),
        projects!inner(name)
      `)
      .eq('id', shiftId)
      .single()

    if (!shift) return

    const staffData = shift.staff as unknown as { user_id: string; display_name: string }
    const projectData = shift.projects as unknown as { name: string }
    const userId = staffData.user_id
    if (!userId) return

    const token = await getValidTokenForUser(userId)
    if (!token) {
      console.warn(`No valid Google token for user ${userId}, skipping calendar sync`)
      return
    }

    const client = new GoogleCalendarClient(token.accessToken, token.refreshToken || undefined)

    const startDateTime = `${shift.shift_date}T${shift.start_time}:00+09:00`
    const endDateTime = `${shift.shift_date}T${shift.end_time}:00+09:00`
    const summary = `[${projectData.name}] シフト`
    const description = shift.notes || undefined

    if (shift.google_calendar_event_id) {
      // 既存イベント更新
      await client.updateEvent({
        eventId: shift.google_calendar_event_id,
        summary,
        description,
        startDateTime,
        endDateTime,
      })
    } else {
      // 新規イベント作成 + Meet URL
      const { eventId, meetUrl } = await client.createEvent({
        summary,
        description,
        startDateTime,
        endDateTime,
        withMeet: true,
      })

      // DB更新: event_id + meet_url保存
      await admin.from('shifts').update({
        google_calendar_event_id: eventId,
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
export async function deleteShiftFromCalendar(shiftId: string): Promise<void> {
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

    const client = new GoogleCalendarClient(token.accessToken, token.refreshToken || undefined)
    await client.deleteEvent('primary', shift.google_calendar_event_id)
  } catch (error) {
    console.error('deleteShiftFromCalendar error:', shiftId, error)
  }
}
