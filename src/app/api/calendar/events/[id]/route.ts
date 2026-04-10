import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'

interface RouteParams {
  params: Promise<{ id: string }>
}

const updateEventSchema = z.object({
  summary: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  start_datetime: z.string().datetime({ offset: true }).optional(),
  end_datetime: z.string().datetime({ offset: true }).optional(),
  attendees: z.array(z.string().email()).optional(),
})

/**
 * PUT /api/calendar/events/[id]
 * Google Calendar イベントを更新
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { summary, description, start_datetime, end_datetime, attendees } = parsed.data

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
      summary,
      description,
      startDateTime: start_datetime,
      endDateTime: end_datetime,
      attendees,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PUT /api/calendar/events/[id] error:', error)
    return NextResponse.json({ error: 'イベントの更新に失敗しました' }, { status: 500 })
  }
}

/**
 * DELETE /api/calendar/events/[id]
 * Google Calendar イベントを削除
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: eventId } = await params
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
    console.error('DELETE /api/calendar/events/[id] error:', error)
    return NextResponse.json({ error: 'イベントの削除に失敗しました' }, { status: 500 })
  }
}
