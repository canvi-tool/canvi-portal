import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// 管理者用：全メンバーの当日打刻状況 + 月次サマリー
export async function GET(request: NextRequest) {
  try {
    if (DEMO_MODE) {
      return NextResponse.json({
        today: [],
        summary: { total_staff: 0, clocked_in: 0, on_break: 0, clocked_out: 0, not_clocked_in: 0 },
      })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 管理者のみ
    if (!isOwner(user) && !isAdmin(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const yearMonth = searchParams.get('year_month') // YYYY-MM

    // JSTで今日の日付
    const now = new Date()
    const jstOffset = 9 * 60 * 60 * 1000
    const jstDate = new Date(now.getTime() + jstOffset)
    const today = jstDate.toISOString().split('T')[0]

    // 本日シフトが登録されているスタッフのみ対象
    const { data: todayShifts } = await supabase
      .from('shifts')
      .select('staff_id')
      .eq('shift_date', today)
      .is('deleted_at', null)
    const shiftStaffIds = Array.from(new Set((todayShifts || []).map((s) => s.staff_id).filter(Boolean))) as string[]

    if (shiftStaffIds.length === 0) {
      return NextResponse.json({
        today: [],
        summary: { total_staff: 0, clocked_in: 0, on_break: 0, clocked_out: 0, not_clocked_in: 0 },
      })
    }

    const { data: activeStaffRaw } = await supabase
      .from('staff')
      .select('id, user_id, last_name, first_name, email')
      .in('id', shiftStaffIds)
      .is('deleted_at', null)
      .order('last_name')

    // display_name を合成
    const activeStaff = (activeStaffRaw || []).map(s => ({
      ...s,
      display_name: `${s.last_name} ${s.first_name}`,
    }))

    if (!activeStaffRaw || activeStaff.length === 0) {
      return NextResponse.json({
        today: [],
        summary: { total_staff: 0, clocked_in: 0, on_break: 0, clocked_out: 0, not_clocked_in: 0 },
      })
    }

    // 今日の打刻一覧
    const staffUserIds = activeStaff.map(s => s.user_id).filter(Boolean) as string[]

    const { data: todayRecords } = await supabase
      .from('attendance_records')
      .select('*, project:project_id(id, name, project_code)')
      .eq('date', today)
      .is('deleted_at', null)
      .in('user_id', staffUserIds)

    // スタッフごとの打刻マップ
    const attendanceMap = new Map<string, typeof todayRecords extends (infer T)[] | null ? T : never>()
    if (todayRecords) {
      for (const rec of todayRecords) {
        attendanceMap.set(rec.user_id, rec)
      }
    }

    // 今日のステータス一覧
    const todayStatus = activeStaff.map(staff => {
      const record = staff.user_id ? attendanceMap.get(staff.user_id) : null
      return {
        staff_id: staff.id,
        user_id: staff.user_id,
        display_name: staff.display_name,
        email: staff.email,
        status: record ? record.status : 'not_clocked_in',
        clock_in: record?.clock_in || null,
        clock_out: record?.clock_out || null,
        work_minutes: record?.work_minutes || null,
        break_minutes: record?.break_minutes || 0,
        project: record?.project || null,
        attendance_id: record?.id || null,
      }
    })

    // サマリー
    const summary = {
      total_staff: activeStaff.length,
      clocked_in: todayStatus.filter(s => s.status === 'clocked_in').length,
      on_break: todayStatus.filter(s => s.status === 'on_break').length,
      clocked_out: todayStatus.filter(s => ['clocked_out', 'modified', 'approved'].includes(s.status)).length,
      not_clocked_in: todayStatus.filter(s => s.status === 'not_clocked_in').length,
    }

    // 月次サマリー（オプション）
    let monthlySummary = null
    if (yearMonth) {
      const monthStart = `${yearMonth}-01`
      const nextMonth = new Date(`${yearMonth}-01`)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      const monthEnd = nextMonth.toISOString().split('T')[0]

      const { data: monthRecords } = await supabase
        .from('attendance_records')
        .select('user_id, work_minutes, overtime_minutes, break_minutes')
        .gte('date', monthStart)
        .lt('date', monthEnd)
        .is('deleted_at', null)
        .in('user_id', staffUserIds)

      if (monthRecords) {
        // スタッフ別集計
        const staffSummary = new Map<string, { workDays: number; totalWork: number; totalOvertime: number }>()
        for (const rec of monthRecords) {
          const existing = staffSummary.get(rec.user_id) || { workDays: 0, totalWork: 0, totalOvertime: 0 }
          existing.workDays += 1
          existing.totalWork += rec.work_minutes || 0
          existing.totalOvertime += rec.overtime_minutes || 0
          staffSummary.set(rec.user_id, existing)
        }

        monthlySummary = {
          year_month: yearMonth,
          total_records: monthRecords.length,
          staff_summaries: activeStaff.map(staff => ({
            staff_id: staff.id,
            display_name: staff.display_name,
            ...(staff.user_id ? staffSummary.get(staff.user_id) || { workDays: 0, totalWork: 0, totalOvertime: 0 } : { workDays: 0, totalWork: 0, totalOvertime: 0 }),
          })),
        }
      }
    }

    return NextResponse.json({
      today: todayStatus,
      summary,
      monthly: monthlySummary,
    })
  } catch (error) {
    console.error('GET /api/attendance/summary error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
