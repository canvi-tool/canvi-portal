import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'

interface RouteParams {
  params: Promise<{ eventId: string }>
}

/**
 * PUT /api/gcal-events/[eventId]
 * Googleカレンダーイベントの時間を更新する
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { startDateTime, endDateTime, summary, description, attendees } = body as {
      startDateTime?: string
      endDateTime?: string
      summary?: string
      description?: string
      attendees?: string[]
    }

    const attendeesProvided = Array.isArray(attendees)
    if (!startDateTime && !endDateTime && summary === undefined && description === undefined && !attendeesProvided) {
      return NextResponse.json({ error: '更新フィールドがありません' }, { status: 400 })
    }

    const token = await getValidTokenForUser(user.id)
    if (!token) {
      return NextResponse.json(
        { error: 'Googleカレンダーの認証が必要です。再ログインしてください。' },
        { status: 401 }
      )
    }

    const client = await GoogleCalendarClient.create(token.accessToken, token.refreshToken || undefined)

    await client.updateEvent({
      eventId,
      startDateTime,
      endDateTime,
      summary: summary !== undefined ? summary : undefined,
      description: description !== undefined ? description : undefined,
      attendees: attendeesProvided ? (attendees as string[]) : undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PUT /api/gcal-events/[eventId] error:', error)
    return NextResponse.json({ error: 'Googleカレンダーイベントの更新に失敗しました' }, { status: 500 })
  }
}

/**
 * DELETE /api/gcal-events/[eventId]
 * Googleカレンダーイベントを削除する
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { eventId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const token = await getValidTokenForUser(user.id)
    if (!token) {
      return NextResponse.json(
        { error: 'Googleカレンダーの認証が必要です。再ログインしてください。' },
        { status: 401 }
      )
    }

    const client = await GoogleCalendarClient.create(token.accessToken, token.refreshToken || undefined)
    await client.deleteEvent('primary', eventId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/gcal-events/[eventId] error:', error)
    return NextResponse.json({ error: 'Googleカレンダーイベントの削除に失敗しました' }, { status: 500 })
  }
}
