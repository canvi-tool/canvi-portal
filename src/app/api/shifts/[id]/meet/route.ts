import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'

interface RouteParams {
  params: Promise<{ id: string }>
}

// start_time is "HH:MM" or "HH:MM:SS" from DB — normalize to HH:MM:SS
const normalizeTime = (t: string) => t.length === 5 ? `${t}:00` : t.slice(0, 8)

/**
 * POST /api/shifts/[id]/meet
 * シフトにGoogle Meet URLを発行する
 * - google_calendar_event_idがある場合: 既存イベントにMeetをpatchで追加
 * - ない場合: 新規イベント作成 + Meet URL発行
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: shiftId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: shift } = await admin
      .from('shifts')
      .select(`
        id, staff_id, project_id, shift_date, start_time, end_time,
        notes, google_calendar_event_id, google_meet_url,
        staff!inner(user_id, last_name, first_name),
        projects!inner(name)
      `)
      .eq('id', shiftId)
      .is('deleted_at', null)
      .single()

    if (!shift) {
      return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
    }

    // 既にMeet URLがある場合
    if (shift.google_meet_url) {
      return NextResponse.json({ meetUrl: shift.google_meet_url })
    }

    const staffData = shift.staff as unknown as { user_id: string; last_name: string; first_name: string }
    const projectData = shift.projects as unknown as { name: string }

    const token = await getValidTokenForUser(user.id)
    if (!token) {
      return NextResponse.json(
        { error: 'Googleカレンダーの認証が必要です。再ログインしてください。' },
        { status: 401 }
      )
    }

    const client = new GoogleCalendarClient(token.accessToken, token.refreshToken || undefined)

    let eventId = shift.google_calendar_event_id
    let meetUrl: string | null = null

    if (eventId) {
      // 既存イベントにMeetをpatchで追加（イベントを削除しない）
      const result = await client.addMeetToEvent({ eventId })
      meetUrl = result.meetUrl
    } else {
      // カレンダーイベントがない場合: 新規作成 + Meet URL発行
      const startDateTime = `${shift.shift_date}T${normalizeTime(shift.start_time)}+09:00`
      const endDateTime = `${shift.shift_date}T${normalizeTime(shift.end_time)}+09:00`
      const summary = `${projectData.name} シフト - ${staffData.last_name} ${staffData.first_name}`

      const result = await client.createEvent({
        summary,
        description: shift.notes || undefined,
        startDateTime,
        endDateTime,
        withMeet: true,
      })
      eventId = result.eventId
      meetUrl = result.meetUrl
    }

    // DB更新
    await admin.from('shifts').update({
      google_calendar_event_id: eventId,
      google_meet_url: meetUrl,
      google_calendar_synced: true,
    }).eq('id', shiftId)

    return NextResponse.json({ meetUrl, eventId })
  } catch (error) {
    console.error('POST /api/shifts/[id]/meet error:', error)
    return NextResponse.json({ error: 'Meet URLの発行に失敗しました' }, { status: 500 })
  }
}

/**
 * DELETE /api/shifts/[id]/meet
 * シフトからGoogle Meet URLを削除する
 * Googleカレンダーのイベント自体は残し、Meetだけ解除
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: shiftId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: shift } = await admin
      .from('shifts')
      .select('id, google_calendar_event_id, google_meet_url, staff!inner(user_id)')
      .eq('id', shiftId)
      .is('deleted_at', null)
      .single()

    if (!shift) {
      return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
    }

    if (!shift.google_meet_url) {
      return NextResponse.json({ success: true })
    }

    // GCalイベントからMeetだけ削除（イベント自体は残す）
    if (shift.google_calendar_event_id) {
      const staffData = shift.staff as unknown as { user_id: string }
      const token = await getValidTokenForUser(staffData.user_id)

      if (token) {
        const client = new GoogleCalendarClient(token.accessToken, token.refreshToken || undefined)
        try {
          await client.removeMeetFromEvent({ eventId: shift.google_calendar_event_id })
        } catch (e) {
          // Meet削除に失敗してもDB側はクリアする
          console.warn('Failed to remove Meet from GCal event:', e)
        }
      }
    }

    // DB更新: Meet URLのみクリア（イベントIDは維持）
    await admin.from('shifts').update({
      google_meet_url: null,
    }).eq('id', shiftId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/shifts/[id]/meet error:', error)
    return NextResponse.json({ error: 'Meet URLの削除に失敗しました' }, { status: 500 })
  }
}
