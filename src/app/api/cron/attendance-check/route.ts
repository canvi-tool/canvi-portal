import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendSlackAlert,
  buildMissingClockNotification,
  buildOvertimeWarningNotification,
} from '@/lib/integrations/slack'

/**
 * 勤怠チェック Cron Job
 * - シフトありだが打刻なし（打刻漏れ検知）
 * - 勤務時間10時間超の残業警告
 *
 * 毎日 22:00 JST (13:00 UTC) に実行
 */
export async function GET(request: NextRequest) {
  // Cron認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()

    // JSTで今日の日付
    const now = new Date()
    const jstOffset = 9 * 60 * 60 * 1000
    const jstDate = new Date(now.getTime() + jstOffset)
    const today = jstDate.toISOString().split('T')[0]

    const results = {
      missing_clock: { checked: 0, alerted: 0, names: [] as string[] },
      overtime: { checked: 0, alerted: 0, names: [] as string[] },
    }

    // 1. 打刻漏れチェック: 今日シフトがあるが打刻がないメンバー
    const { data: todayShifts } = await admin
      .from('shifts')
      .select('staff_id, staff:staff_id(display_name, user_id)')
      .eq('shift_date', today)
      .is('deleted_at', null)
      .in('status', ['APPROVED', 'SUBMITTED'])

    if (todayShifts && todayShifts.length > 0) {
      // 打刻済みのuser_idを取得
      const { data: todayAttendance } = await admin
        .from('attendance_records')
        .select('user_id')
        .eq('date', today)
        .is('deleted_at', null)

      const clockedUserIds = new Set((todayAttendance || []).map(a => a.user_id))
      const missingNames: string[] = []

      for (const shift of todayShifts) {
        results.missing_clock.checked++
        const staff = shift.staff as unknown as { display_name: string; user_id: string } | null
        if (staff?.user_id && !clockedUserIds.has(staff.user_id)) {
          missingNames.push(staff.display_name)
        }
      }

      if (missingNames.length > 0) {
        results.missing_clock.alerted = missingNames.length
        results.missing_clock.names = missingNames
        await sendSlackAlert(buildMissingClockNotification(missingNames, today))
      }
    }

    // 2. 残業警告: 勤務時間10時間超
    const { data: longWorkRecords } = await admin
      .from('attendance_records')
      .select('user_id, work_minutes, staff:staff_id(display_name)')
      .eq('date', today)
      .is('deleted_at', null)
      .gt('work_minutes', 600) // 10時間 = 600分

    if (longWorkRecords) {
      for (const rec of longWorkRecords) {
        results.overtime.checked++
        const staff = rec.staff as unknown as { display_name: string } | null
        const name = staff?.display_name || 'Unknown'
        const hours = Math.round((rec.work_minutes || 0) / 60 * 10) / 10
        results.overtime.alerted++
        results.overtime.names.push(name)
        await sendSlackAlert(buildOvertimeWarningNotification(name, hours, today))
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      results,
    })
  } catch (error) {
    console.error('Attendance check cron error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
