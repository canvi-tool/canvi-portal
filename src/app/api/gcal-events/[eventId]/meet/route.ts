import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'

interface RouteParams {
  params: Promise<{ eventId: string }>
}

/**
 * POST /api/gcal-events/[eventId]/meet
 * GoogleカレンダーイベントにMeet URLを追加する
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
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
    const result = await client.addMeetToEvent({ eventId })

    return NextResponse.json({ meetUrl: result.meetUrl })
  } catch (error) {
    console.error('POST /api/gcal-events/[eventId]/meet error:', error)
    return NextResponse.json({ error: 'Meet URLの発行に失敗しました' }, { status: 500 })
  }
}

/**
 * DELETE /api/gcal-events/[eventId]/meet
 * GoogleカレンダーイベントからMeet URLを削除する
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
    await client.removeMeetFromEvent({ eventId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/gcal-events/[eventId]/meet error:', error)
    return NextResponse.json({ error: 'Meet URLの削除に失敗しました' }, { status: 500 })
  }
}
