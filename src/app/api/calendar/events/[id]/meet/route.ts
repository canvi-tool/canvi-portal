import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/calendar/events/[id]/meet
 * Google CalendarイベントにMeet URLを追加
 * 既存イベントを削除→Meet付きで再作成
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const summary = body.summary || ''
    const description = body.description || ''
    const startDatetime = body.start_datetime || ''
    const endDatetime = body.end_datetime || ''

    if (!startDatetime || !endDatetime) {
      return NextResponse.json({ error: '日時情報が必要です' }, { status: 400 })
    }

    const token = await getValidTokenForUser(user.id)
    if (!token) {
      return NextResponse.json(
        { error: 'Googleカレンダーの認証が必要です。再ログインしてください。' },
        { status: 401 }
      )
    }

    const client = await GoogleCalendarClient.create(token.accessToken, token.refreshToken || undefined)

    // 既存イベント削除
    try {
      await client.deleteEvent('primary', eventId)
    } catch {
      // 削除失敗は無視
    }

    // Meet付きで再作成
    const { eventId: newEventId, meetUrl } = await client.createEvent({
      summary,
      description,
      startDateTime: startDatetime,
      endDateTime: endDatetime,
      withMeet: true,
    })

    return NextResponse.json({ eventId: newEventId, meetUrl })
  } catch (error) {
    console.error('POST /api/calendar/events/[id]/meet error:', error)
    return NextResponse.json({ error: 'Meet URLの発行に失敗しました' }, { status: 500 })
  }
}

/**
 * DELETE /api/calendar/events/[id]/meet
 * Google CalendarイベントからMeet URLを削除
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const summary = body.summary || ''
    const description = body.description || ''
    const startDatetime = body.start_datetime || ''
    const endDatetime = body.end_datetime || ''

    if (!startDatetime || !endDatetime) {
      return NextResponse.json({ error: '日時情報が必要です' }, { status: 400 })
    }

    const token = await getValidTokenForUser(user.id)
    if (!token) {
      return NextResponse.json(
        { error: 'Googleカレンダーの認証が必要です。' },
        { status: 401 }
      )
    }

    const client = await GoogleCalendarClient.create(token.accessToken, token.refreshToken || undefined)

    // 既存イベント削除
    try {
      await client.deleteEvent('primary', eventId)
    } catch {
      // 削除失敗は無視
    }

    // Meetなしで再作成
    const { eventId: newEventId } = await client.createEvent({
      summary,
      description,
      startDateTime: startDatetime,
      endDateTime: endDatetime,
      withMeet: false,
    })

    return NextResponse.json({ eventId: newEventId, success: true })
  } catch (error) {
    console.error('DELETE /api/calendar/events/[id]/meet error:', error)
    return NextResponse.json({ error: 'Meet URLの削除に失敗しました' }, { status: 500 })
  }
}
