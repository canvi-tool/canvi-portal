import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/shifts/[id]/meet
 * シフトにGoogle Meet URLを発行する
 * - google_calendar_event_idがある場合: 既存イベントにMeetを追加
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
        staff!inner(user_id, display_name),
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

    const staffData = shift.staff as unknown as { user_id: string; display_name: string }
    const projectData = shift.projects as unknown as { name: string }

    const token = await getValidTokenForUser(user.id)
    if (!token) {
      return NextResponse.json(
        { error: 'Googleカレンダーの認証が必要です。再ログインしてください。' },
        { status: 401 }
      )
    }

    const client = new GoogleCalendarClient(token.accessToken, token.refreshToken || undefined)
    const startDateTime = `${shift.shift_date}T${shift.start_time}:00+09:00`
    const endDateTime = `${shift.shift_date}T${shift.end_time}:00+09:00`
    const summary = `[${projectData.name}] シフト - ${staffData.display_name}`

    if (shift.google_calendar_event_id) {
      // 既存イベントにMeetを追加するため、イベントを再作成（patch不可のため）
      // まず既存イベントを削除して、Meetありで再作成
      try {
        await client.deleteEvent('primary', shift.google_calendar_event_id)
      } catch {
        // 削除できなくても続行
      }
    }

    // Meet付きで新規作成
    const { eventId, meetUrl } = await client.createEvent({
      summary,
      description: shift.notes || undefined,
      startDateTime,
      endDateTime,
      withMeet: true,
    })

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
      .select(`
        id, staff_id, project_id, shift_date, start_time, end_time,
        notes, google_calendar_event_id, google_meet_url,
        staff!inner(user_id, display_name),
        projects!inner(name)
      `)
      .eq('id', shiftId)
      .is('deleted_at', null)
      .single()

    if (!shift) {
      return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
    }

    if (!shift.google_meet_url) {
      return NextResponse.json({ success: true })
    }

    const token = await getValidTokenForUser(user.id)
    if (!token) {
      return NextResponse.json(
        { error: 'Googleカレンダーの認証が必要です。' },
        { status: 401 }
      )
    }

    const client = new GoogleCalendarClient(token.accessToken, token.refreshToken || undefined)
    const staffData = shift.staff as unknown as { user_id: string; display_name: string }
    const projectData = shift.projects as unknown as { name: string }

    // Meetなしでイベントを再作成
    if (shift.google_calendar_event_id) {
      try {
        await client.deleteEvent('primary', shift.google_calendar_event_id)
      } catch {
        // 削除できなくても続行
      }
    }

    const startDateTime = `${shift.shift_date}T${shift.start_time}:00+09:00`
    const endDateTime = `${shift.shift_date}T${shift.end_time}:00+09:00`
    const summary = `[${projectData.name}] シフト - ${staffData.display_name}`

    const { eventId } = await client.createEvent({
      summary,
      description: shift.notes || undefined,
      startDateTime,
      endDateTime,
      withMeet: false,
    })

    // DB更新: Meet URLをクリア
    await admin.from('shifts').update({
      google_calendar_event_id: eventId,
      google_meet_url: null,
    }).eq('id', shiftId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/shifts/[id]/meet error:', error)
    return NextResponse.json({ error: 'Meet URLの削除に失敗しました' }, { status: 500 })
  }
}
