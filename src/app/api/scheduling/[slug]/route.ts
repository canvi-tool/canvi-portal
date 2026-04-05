import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'

/**
 * GET /api/scheduling/[slug]
 * 公開API: 日程調整リンクの空き時間を取得
 * 認証不要（外部ゲスト用）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const admin = createAdminClient()

    // リンク情報取得
    const { data: link, error } = await admin
      .from('scheduling_links')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (error || !link) {
      return NextResponse.json({ error: 'このリンクは無効または期限切れです' }, { status: 404 })
    }

    // 期限チェック
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      await admin.from('scheduling_links').update({ status: 'expired' }).eq('id', link.id)
      return NextResponse.json({ error: 'このリンクは期限切れです' }, { status: 410 })
    }

    // 既存予約を取得（booked済みスロットを除外するため）
    const { data: bookings } = await admin
      .from('scheduling_bookings')
      .select('selected_start, selected_end')
      .eq('link_id', link.id)
      .eq('status', 'confirmed')

    // メンバーの名前を取得
    const { data: users } = await admin
      .from('users')
      .select('id, email, display_name')
      .in('id', link.member_ids)

    // 各メンバーのGoogleカレンダー予定を取得
    const timeMin = `${link.date_range_start}T00:00:00+09:00`
    const timeMax = `${link.date_range_end}T23:59:59+09:00`

    const memberBusy: Record<string, Array<{ start: string; end: string }>> = {}

    const busyPromises = (users || []).map(async (u) => {
      const token = await getValidTokenForUser(u.id)
      if (!token) return { id: u.id, busy: [] as Array<{ start: string; end: string }> }
      try {
        const client = new GoogleCalendarClient(token.accessToken, token.refreshToken || undefined)
        const busy = await client.getBusyFromEvents({ timeMin, timeMax })
        return { id: u.id, busy: busy.map(b => ({ start: b.start, end: b.end })) }
      } catch {
        return { id: u.id, busy: [] as Array<{ start: string; end: string }> }
      }
    })

    const busyResults = await Promise.all(busyPromises)
    for (const r of busyResults) {
      memberBusy[r.id] = r.busy
    }

    // シフトも取得
    const { data: shifts } = await admin
      .from('shifts')
      .select('staff_id, shift_date, start_time, end_time, staff!inner(user_id)')
      .gte('shift_date', link.date_range_start)
      .lte('shift_date', link.date_range_end)
      .is('deleted_at', null)
      .in('status', ['APPROVED', 'SUBMITTED'])

    for (const s of (shifts || [])) {
      const staffData = s.staff as unknown as { user_id: string }
      const uid = staffData.user_id
      if (link.member_ids.includes(uid)) {
        if (!memberBusy[uid]) memberBusy[uid] = []
        memberBusy[uid].push({
          start: `${s.shift_date}T${s.start_time}+09:00`,
          end: `${s.shift_date}T${s.end_time}+09:00`,
        })
      }
    }

    // 空きスロットを算出
    const slots = computeAvailableSlots({
      memberIds: link.member_ids,
      memberBusy,
      mode: link.mode as 'all_free' | 'any_free',
      dateRangeStart: link.date_range_start,
      dateRangeEnd: link.date_range_end,
      timeRangeStart: link.time_range_start,
      timeRangeEnd: link.time_range_end,
      durationMinutes: link.duration_minutes,
      bookedSlots: (bookings || []).map(b => ({ start: b.selected_start, end: b.selected_end })),
    })

    // メンバー名一覧（ゲストに見せる）
    const memberNames = (users || []).map(u => u.display_name || u.email)

    return NextResponse.json({
      title: link.title,
      memberNames,
      mode: link.mode,
      durationMinutes: link.duration_minutes,
      slots,
    })
  } catch (error) {
    console.error('GET /api/scheduling/[slug] error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

function computeAvailableSlots(params: {
  memberIds: string[]
  memberBusy: Record<string, Array<{ start: string; end: string }>>
  mode: 'all_free' | 'any_free'
  dateRangeStart: string
  dateRangeEnd: string
  timeRangeStart: string
  timeRangeEnd: string
  durationMinutes: number
  bookedSlots: Array<{ start: string; end: string }>
}): Array<{ start: string; end: string; date: string; startTime: string; endTime: string }> {
  const {
    memberIds, memberBusy, mode,
    dateRangeStart, dateRangeEnd,
    timeRangeStart, timeRangeEnd,
    durationMinutes, bookedSlots,
  } = params

  const slots: Array<{ start: string; end: string; date: string; startTime: string; endTime: string }> = []
  const slotMs = durationMinutes * 60 * 1000
  const stepMs = 30 * 60 * 1000 // 30分刻み

  // 日付文字列の配列を生成（タイムゾーン問題回避）
  const dates: string[] = []
  const [sy, sm, sd] = dateRangeStart.split('-').map(Number)
  const [ey, em, ed] = dateRangeEnd.split('-').map(Number)
  const startD = new Date(sy, sm - 1, sd)
  const endD = new Date(ey, em - 1, ed)
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    dates.push(`${yyyy}-${mm}-${dd}`)
  }

  // 今日の日付（JST）
  const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const todayStr = `${nowJST.getUTCFullYear()}-${String(nowJST.getUTCMonth() + 1).padStart(2, '0')}-${String(nowJST.getUTCDate()).padStart(2, '0')}`

  for (const dateStr of dates) {
    // 過去の日付はスキップ
    if (dateStr < todayStr) continue

    const dayStart = new Date(`${dateStr}T${timeRangeStart}:00+09:00`).getTime()
    const dayEnd = new Date(`${dateStr}T${timeRangeEnd}:00+09:00`).getTime()

    for (let t = dayStart; t + slotMs <= dayEnd; t += stepMs) {
      const slotStart = t
      const slotEnd = t + slotMs

      // 既に予約済みかチェック
      const isBooked = bookedSlots.some(b => {
        const bs = new Date(b.start).getTime()
        const be = new Date(b.end).getTime()
        return slotStart < be && slotEnd > bs
      })
      if (isBooked) continue

      // モードに応じた空き判定
      if (mode === 'all_free') {
        // 全員が空いている必要がある
        const allFree = memberIds.every(id => {
          const busy = memberBusy[id] || []
          return !busy.some(b => {
            const bs = new Date(b.start).getTime()
            const be = new Date(b.end).getTime()
            return slotStart < be && slotEnd > bs
          })
        })
        if (!allFree) continue
      } else {
        // いずれか1人が空いていればOK
        const anyFree = memberIds.some(id => {
          const busy = memberBusy[id] || []
          return !busy.some(b => {
            const bs = new Date(b.start).getTime()
            const be = new Date(b.end).getTime()
            return slotStart < be && slotEnd > bs
          })
        })
        if (!anyFree) continue
      }

      slots.push({
        start: new Date(slotStart).toISOString(),
        end: new Date(slotEnd).toISOString(),
        date: dateStr,
        startTime: formatTimeJST(slotStart),
        endTime: formatTimeJST(slotEnd),
      })
    }
  }

  return slots
}

function formatTimeJST(ms: number): string {
  const d = new Date(ms)
  // UTC+9 offset
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`
}
