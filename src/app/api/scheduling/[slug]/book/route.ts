import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'
import { sendEmail } from '@/lib/email/send'
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

    // メンバー情報取得（GCal招待 + 確認メール共通）
    const { data: members } = await admin
      .from('users')
      .select('email, display_name')
      .in('id', link.member_ids)
    const memberEmails = (members || []).map(m => m.email).filter(Boolean) as string[]
    const memberNames = (members || []).map(m => m.display_name || m.email).filter(Boolean) as string[]

    // Googleカレンダーにイベントを作成（リンク作成者のトークンを使用）
    let meetUrl = ''
    let eventId = ''
    try {
      const token = await getValidTokenForUser(link.created_by)
      if (token) {
        const attendeeEmails = [...memberEmails, data.guest_email]

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

    // 確定メール（TimeRex風）を全員に送信（ゲスト + メンバー全員）
    try {
      const fmtDateJP = (iso: string) => {
        const d = new Date(iso)
        const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
        const y = jst.getUTCFullYear()
        const m = jst.getUTCMonth() + 1
        const day = jst.getUTCDate()
        const wd = ['日', '月', '火', '水', '木', '金', '土'][jst.getUTCDay()]
        const hh = String(jst.getUTCHours()).padStart(2, '0')
        const mm = String(jst.getUTCMinutes()).padStart(2, '0')
        return { date: `${y}年${m}月${day}日（${wd}）`, time: `${hh}:${mm}` }
      }
      const s = fmtDateJP(data.selected_start)
      const e = fmtDateJP(data.selected_end)
      const subject = `【日程確定】${data.guest_name}様との${link.title}`
      const meetBlock = meetUrl
        ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0;">
             <p style="margin:0 0 6px;font-size:13px;color:#1e40af;font-weight:600;">Google Meet</p>
             <a href="${meetUrl}" style="font-size:14px;color:#2563eb;word-break:break-all;">${meetUrl}</a>
             <p style="margin:8px 0 0;font-size:12px;color:#1e40af;">当日このリンクからご参加ください</p>
           </div>`
        : ''
      const html = `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-block;background:#4f46e5;color:#fff;font-size:22px;font-weight:bold;width:44px;height:44px;line-height:44px;border-radius:10px;">C</div>
            <h1 style="margin:12px 0 0;font-size:20px;color:#0f172a;">日程が確定しました</h1>
          </div>
          <p style="color:#334155;font-size:14px;line-height:1.8;">
            以下の内容で日程が確定しました。当日はお時間になりましたらGoogle Meetにてお繋ぎください。
          </p>
          <div style="background:#f1f5f9;border-radius:10px;padding:18px;margin:16px 0;">
            <p style="margin:0 0 4px;font-size:12px;color:#64748b;">予定</p>
            <p style="margin:0 0 12px;font-size:16px;color:#0f172a;font-weight:600;">${link.title}</p>
            <p style="margin:0 0 4px;font-size:12px;color:#64748b;">日時</p>
            <p style="margin:0 0 12px;font-size:15px;color:#0f172a;font-weight:600;">${s.date} ${s.time} 〜 ${e.time}（${link.duration_minutes}分）</p>
            <p style="margin:0 0 4px;font-size:12px;color:#64748b;">担当</p>
            <p style="margin:0 0 12px;font-size:14px;color:#0f172a;">${memberNames.join('、') || '-'}</p>
            <p style="margin:0 0 4px;font-size:12px;color:#64748b;">ゲスト</p>
            <p style="margin:0;font-size:14px;color:#0f172a;">
              ${data.guest_name}${data.guest_company ? `（${data.guest_company}）` : ''}<br/>
              ${data.guest_email} / ${data.guest_phone}
            </p>
          </div>
          ${meetBlock}
          ${data.message ? `<div style="background:#fafafa;border-left:3px solid #cbd5e1;padding:12px 14px;margin:16px 0;"><p style="margin:0 0 4px;font-size:12px;color:#64748b;">メッセージ</p><p style="margin:0;font-size:13px;color:#334155;white-space:pre-wrap;">${data.message}</p></div>` : ''}
          <p style="color:#94a3b8;font-size:12px;line-height:1.7;margin-top:24px;">
            変更・キャンセルをご希望の場合は、担当者までご連絡ください。
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
          <p style="color:#94a3b8;font-size:11px;text-align:center;">Canvi Portal</p>
        </div>
      `
      const recipients = Array.from(new Set([data.guest_email, ...memberEmails]))
      await Promise.allSettled(
        recipients.map((to) => sendEmail({ to, subject, html }))
      )
    } catch (e) {
      console.warn('Confirmation email send failed:', e)
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
