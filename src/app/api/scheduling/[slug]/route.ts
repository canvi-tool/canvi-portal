import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAvailableSlots } from '@/lib/scheduling/compute-slots'
import { fetchMemberBusy } from '@/lib/scheduling/fetch-busy'

/**
 * GET /api/scheduling/[slug]
 * 公開API: 日程調整リンクの空き時間を取得
 * 認証不要（外部ゲスト用）
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const admin = createAdminClient()

    const { data: link, error } = await admin
      .from('scheduling_links')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (error || !link) {
      return NextResponse.json({ error: 'このリンクは無効または期限切れです' }, { status: 404 })
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      await admin.from('scheduling_links').update({ status: 'expired' }).eq('id', link.id)
      return NextResponse.json({ error: 'このリンクは期限切れです' }, { status: 410 })
    }

    const { data: bookings } = await admin
      .from('scheduling_bookings')
      .select('selected_start, selected_end')
      .eq('link_id', link.id)
      .eq('status', 'confirmed')

    const { data: users } = await admin
      .from('users')
      .select('id, email, display_name')
      .in('id', link.member_ids)

    // date_range_start/end が TIMESTAMPTZ で保存されている場合に YYYY-MM-DD (JST) に正規化
    const toJstYmd = (v: string): string => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
      const d = new Date(v)
      const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
      return jst.toISOString().slice(0, 10)
    }
    const dateRangeStart = toJstYmd(link.date_range_start)
    const dateRangeEnd = toJstYmd(link.date_range_end)

    // DB の time 型は "HH:MM:SS" で返るため、compute-slots が期待する "HH:MM" に正規化
    const toHHMM = (t: string): string => (t || '').slice(0, 5)
    const timeRangeStart = toHHMM(link.time_range_start)
    const timeRangeEnd = toHHMM(link.time_range_end)

    const memberBusy = await fetchMemberBusy(
      link.member_ids,
      dateRangeStart,
      dateRangeEnd
    )

    const slots = computeAvailableSlots({
      memberIds: link.member_ids,
      memberBusy,
      mode: link.mode as 'all_free' | 'any_free',
      dateRangeStart,
      dateRangeEnd,
      timeRangeStart,
      timeRangeEnd,
      durationMinutes: link.duration_minutes,
      bookedSlots: (bookings || []).map((b) => ({ start: b.selected_start, end: b.selected_end })),
      weekdays: (link as unknown as { weekdays?: number[] | null }).weekdays ?? undefined,
      excludeHolidays: !!(link as unknown as { exclude_holidays?: boolean }).exclude_holidays,
    })

    const memberNames = (users || []).map((u) => u.display_name || u.email)

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
