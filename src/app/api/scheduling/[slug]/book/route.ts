import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'
import { z } from 'zod'

const bookSchema = z.object({
  guest_name: z.string().min(1, 'お名前は必須です').max(100),
  guest_email: z.string().email('メールアドレスの形式が正しくありません'),
  guest_phone: z.string().min(1, '電話番号は必須です').max(50),
  guest_company: z.string().max(200).optional(),
  selected_start: z.string().datetime({ offset: true }),
  selected_end: z.string().datetime({ offset: true }),
  message: z.string().max(1000).optional(),
})

/**
 * POST /api/scheduling/[slug]/book
 * 公開API: ゲストが日程を予約
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const admin = createAdminClient()

    // リンク取得
    const { data: link, error: linkError } = await admin
      .from('scheduling_links')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (linkError || !link) {
      return NextResponse.json({ error: 'このリンクは無効または期限切れです' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = bookSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'バリデーションエラー', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    // 重複予約チェック
    const { data: existing } = await admin
      .from('scheduling_bookings')
      .select('id')
      .eq('link_id', link.id)
      .eq('status', 'confirmed')
      .lt('selected_start', data.selected_end)
      .gt('selected_end', data.selected_start)

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'この時間帯は既に予約されています' }, { status: 409 })
    }

    // 予約を登録
    const { data: booking, error: bookingError } = await admin
      .from('scheduling_bookings')
      .insert({
        link_id: link.id,
        guest_name: data.guest_name,
        guest_email: data.guest_email,
        guest_phone: data.guest_phone,
        guest_company: data.guest_company || null,
        selected_start: data.selected_start,
        selected_end: data.selected_end,
        message: data.message || null,
      })
      .select()
      .single()

    if (bookingError) {
      console.error('Create booking error:', bookingError)
      return NextResponse.json({ error: '予約の登録に失敗しました' }, { status: 500 })
    }

    // Googleカレンダーにイベントを作成（リンク作成者のトークンを使用）
    let meetUrl = ''
    let eventId = ''
    try {
      const token = await getValidTokenForUser(link.created_by)
      if (token) {
        // メンバーのメールアドレス取得
        const { data: members } = await admin
          .from('users')
          .select('email')
          .in('id', link.member_ids)

        const attendeeEmails = (members || []).map(m => m.email).filter(Boolean) as string[]
        attendeeEmails.push(data.guest_email)

        const client = new GoogleCalendarClient(token.accessToken, token.refreshToken || undefined)
        const result = await client.createEvent({
          summary: `${link.title} - ${data.guest_name}${data.guest_company ? ` (${data.guest_company})` : ''}`,
          description: [
            `日程調整による予約`,
            data.guest_company ? `会社: ${data.guest_company}` : '',
            `ゲスト: ${data.guest_name}`,
            `Email: ${data.guest_email}`,
            `電話: ${data.guest_phone}`,
            data.message ? `\nメッセージ:\n${data.message}` : '',
          ].filter(Boolean).join('\n'),
          startDateTime: data.selected_start,
          endDateTime: data.selected_end,
          withMeet: true,
          attendees: attendeeEmails,
        })

        meetUrl = result.meetUrl || ''
        eventId = result.eventId || ''

        // booking にevent IDを保存
        if (eventId) {
          await admin
            .from('scheduling_bookings')
            .update({ google_calendar_event_id: eventId })
            .eq('id', booking.id)
        }
      }
    } catch (e) {
      console.warn('Calendar event creation failed:', e)
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        selected_start: booking.selected_start,
        selected_end: booking.selected_end,
      },
      meetUrl,
    })
  } catch (error) {
    console.error('POST /api/scheduling/[slug]/book error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
