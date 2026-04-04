import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'

const createEventSchema = z.object({
  user_ids: z.array(z.string()).min(1, '参加者を1名以上指定してください'),
  summary: z.string().min(1).max(500, 'タイトルは500文字以内にしてください'),
  description: z.string().max(5000, '説明は5000文字以内にしてください').optional(),
  start_datetime: z.string().datetime({ message: '開始日時の形式が不正です' }),
  end_datetime: z.string().datetime({ message: '終了日時の形式が不正です' }),
  with_meet: z.boolean().optional().default(true),
}).refine(
  (data) => new Date(data.end_datetime) > new Date(data.start_datetime),
  { message: '終了日時は開始日時より後にしてください', path: ['end_datetime'] }
)

/**
 * POST /api/calendar/events
 * 選択メンバー全員のGoogleカレンダーにイベント作成 + Meet URL発行
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { user_ids, summary, description, start_datetime, end_datetime, with_meet } = parsed.data

    const admin = createAdminClient()

    // 参加者のメールアドレス取得
    const { data: users } = await admin
      .from('users')
      .select('id, email')
      .in('id', user_ids)

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    const attendeeEmails = users.map(u => u.email)

    // 作成者のトークンでイベント作成
    const token = await getValidTokenForUser(user.id)
    if (!token) {
      return NextResponse.json({ error: 'Googleカレンダーの認証が必要です。再ログインしてください。' }, { status: 401 })
    }

    const client = new GoogleCalendarClient(token.accessToken, token.refreshToken || undefined)

    const { eventId, meetUrl } = await client.createEvent({
      summary,
      description,
      startDateTime: start_datetime,
      endDateTime: end_datetime,
      withMeet: with_meet,
      attendees: attendeeEmails,
    })

    return NextResponse.json({
      success: true,
      eventId,
      meetUrl,
      attendees: attendeeEmails,
    })
  } catch (error) {
    console.error('POST /api/calendar/events error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
