import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { fetchMemberBusy } from '@/lib/scheduling/fetch-busy'
import { computeAvailableSlots } from '@/lib/scheduling/compute-slots'

const schema = z.object({
  member_user_ids: z.array(z.string().uuid()).min(1),
  mode: z.enum(['all_free', 'any_free']),
  period_days: z.number().int().min(1).max(60),
  duration_minutes: z.number().int().min(15).max(480),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  exclude_holidays: z.boolean().optional().default(false),
  time_range_start: z.string().regex(/^\d{2}:\d{2}$/).optional().default('09:00'),
  time_range_end: z.string().regex(/^\d{2}:\d{2}$/).optional().default('19:00'),
})

/**
 * POST /api/scheduling/availability
 * 翌日以降の指定条件で空きスロットを即時計算（保存しない）
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'バリデーションエラー', details: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    // 翌日〜period_days
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const end = new Date(tomorrow)
    end.setDate(end.getDate() + data.period_days - 1)
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const dateRangeStart = fmt(tomorrow)
    const dateRangeEnd = fmt(end)

    const memberBusy = await fetchMemberBusy(data.member_user_ids, dateRangeStart, dateRangeEnd)

    const slots = computeAvailableSlots({
      memberIds: data.member_user_ids,
      memberBusy,
      mode: data.mode,
      dateRangeStart,
      dateRangeEnd,
      timeRangeStart: data.time_range_start,
      timeRangeEnd: data.time_range_end,
      durationMinutes: data.duration_minutes,
      weekdays: data.weekdays,
      excludeHolidays: data.exclude_holidays,
    })

    return NextResponse.json({ slots, dateRangeStart, dateRangeEnd })
  } catch (error) {
    console.error('POST /api/scheduling/availability error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
