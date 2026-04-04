import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * シフト未提出リマインダー
 * 毎月20日〜25日に実行: 翌月シフトが未登録のスタッフを検出 → アラート作成
 * Vercel Cron: 0 0 20-25 * * (UTC 00:00 = JST 09:00, 毎月20-25日)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()
    const currentDay = now.getDate()

    // 20日より前は実行しない
    if (currentDay < 20) {
      return NextResponse.json({ message: 'Not in reminder period', alerted: 0 })
    }

    // 翌月の範囲を算出
    const nextMonth = now.getMonth() + 2 // 0-indexed + 1
    const nextYear = nextMonth > 12 ? now.getFullYear() + 1 : now.getFullYear()
    const nextMonthNorm = nextMonth > 12 ? 1 : nextMonth
    const nextMonthStart = `${nextYear}-${String(nextMonthNorm).padStart(2, '0')}-01`
    const nextMonthEnd = `${nextYear}-${String(nextMonthNorm).padStart(2, '0')}-${new Date(nextYear, nextMonthNorm, 0).getDate()}`

    // 稼働中スタッフ一覧
    const { data: activeStaff } = await supabase
      .from('staff')
      .select('id, user_id, last_name, first_name')
      .eq('status', 'active')

    if (!activeStaff || activeStaff.length === 0) {
      return NextResponse.json({ message: 'No active staff', alerted: 0 })
    }

    // 翌月にシフトが登録されているスタッフを検索
    const { data: shiftsNextMonth } = await supabase
      .from('shifts')
      .select('staff_id')
      .gte('shift_date', nextMonthStart)
      .lte('shift_date', nextMonthEnd)
      .is('deleted_at', null)

    const staffWithShifts = new Set(
      (shiftsNextMonth || []).map(s => s.staff_id)
    )

    // シフト未提出のスタッフ
    const unreported = activeStaff.filter(s => !staffWithShifts.has(s.id))

    if (unreported.length === 0) {
      return NextResponse.json({ message: 'All staff have submitted shifts', alerted: 0 })
    }

    // アラート作成（重複防止: 同月・同タイプのアラートが既にあればスキップ）
    const alertMonth = `${nextYear}-${String(nextMonthNorm).padStart(2, '0')}`
    let alertedCount = 0

    for (const staff of unreported) {
      const staffName = `${staff.last_name || ''} ${staff.first_name || ''}`.trim()

      // 既存アラートチェック
      const { data: existing } = await supabase
        .from('alerts')
        .select('id')
        .eq('type', 'unreported_work')
        .eq('related_staff_id', staff.id)
        .like('description', `%${alertMonth}%`)
        .limit(1)

      if (existing && existing.length > 0) continue

      // アラート作成
      await supabase.from('alerts').insert({
        type: 'unreported_work',
        severity: currentDay >= 25 ? 'critical' : 'warning',
        title: `${staffName}: ${alertMonth}月のシフト未提出`,
        description: `${staffName}の${alertMonth}月シフトが未登録です。提出期限: ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-25`,
        related_staff_id: staff.id,
        is_resolved: false,
      })

      alertedCount++
    }

    return NextResponse.json({
      message: `Shift reminder completed`,
      alerted: alertedCount,
      totalUnreported: unreported.length,
      period: alertMonth,
    })
  } catch (error) {
    console.error('Shift reminder cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
