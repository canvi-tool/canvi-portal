import { NextResponse } from 'next/server'
import { getProjectAccess } from '@/lib/auth/project-access'
import { isOwner, isAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

function todayJST() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.format(new Date())
}

function nowJSTHourMinute(): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  })
  return fmt.format(new Date()) // "HH:MM"
}

/** "HH:MM" を分に変換 */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

interface AlertItem {
  type: 'shift_no_attendance_no_report' | 'report_no_attendance'
  staffId: string
  staffName: string
  projectName: string
  shiftDate: string
  shiftTime: string
  message: string
}

export async function GET() {
  try {
    const { user, allowedProjectIds } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const admin = createAdminClient()
    const today = todayJST()
    const nowMinutes = timeToMinutes(nowJSTHourMinute())
    const isOwnerUser = isOwner(user)
    const isAdminUser = isAdmin(user)

    // ── スコープ: 対象スタッフIDリストを取得 ──
    // Owner: null (全員), Admin/Manager: PJメンバー, Member: 自分のみ
    let scopedStaffIds: string[] | null = null

    if (!isOwnerUser) {
      const ids = new Set<string>()
      if (user.staffId) ids.add(user.staffId)

      if (isAdminUser && allowedProjectIds && allowedProjectIds.length > 0) {
        const { data: members } = await admin
          .from('project_assignments')
          .select('staff_id')
          .in('project_id', allowedProjectIds)
          .is('deleted_at', null)
        for (const m of (members || [])) {
          if (m.staff_id) ids.add(m.staff_id as string)
        }
      }

      scopedStaffIds = ids.size > 0 ? Array.from(ids) : ['__none__']
    }

    // ── 本日の承認済みシフト (shift_type = 'WORK') ──
    let shiftQuery = admin
      .from('shifts')
      .select('id, staff_id, project_id, start_time, end_time, shift_date, staff:staff_id(id, last_name, first_name), project:project_id(name)')
      .eq('shift_date', today)
      .eq('status', 'APPROVED')
      .is('deleted_at', null)
      .limit(500)

    if (scopedStaffIds !== null) {
      shiftQuery = shiftQuery.in('staff_id', scopedStaffIds)
    }

    const { data: shifts } = await shiftQuery

    if (!shifts || shifts.length === 0) {
      return NextResponse.json({ alerts: [], count: 0 })
    }

    // 対象スタッフIDリスト（シフトが存在するスタッフ）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const staffIdsWithShifts = [...new Set((shifts as any[]).map(s => s.staff_id).filter(Boolean))]

    // ── 本日の打刻レコード ──
    const { data: attendanceRecords } = await admin
      .from('attendance_records')
      .select('staff_id')
      .eq('date', today)
      .is('deleted_at', null)
      .in('staff_id', staffIdsWithShifts)

    const staffIdsWithAttendance = new Set(
      (attendanceRecords || []).map(a => a.staff_id)
    )

    // ── 本日の日報 (status != 'draft') ──
    const { data: workReports } = await admin
      .from('work_reports')
      .select('staff_id')
      .eq('report_date', today)
      .neq('status', 'draft')
      .is('deleted_at', null)
      .in('staff_id', staffIdsWithShifts)

    const staffIdsWithReport = new Set(
      (workReports || []).map(r => r.staff_id)
    )

    // ── 異常検知 ──
    const alerts: AlertItem[] = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const shift of (shifts as any[])) {
      const staffId = shift.staff_id as string
      const startTime = (shift.start_time as string)?.slice(0, 5) || '00:00'
      const endTime = (shift.end_time as string)?.slice(0, 5) || '00:00'
      const staffName = shift.staff
        ? `${shift.staff.last_name} ${shift.staff.first_name}`
        : '不明'
      const projectName = shift.project?.name || '不明'

      const hasAttendance = staffIdsWithAttendance.has(staffId)
      const hasReport = staffIdsWithReport.has(staffId)
      const shiftStartMinutes = timeToMinutes(startTime)

      // Type A: シフトあり、開始30分以上経過、打刻なし、日報なし
      if (!hasAttendance && !hasReport && nowMinutes >= shiftStartMinutes + 30) {
        alerts.push({
          type: 'shift_no_attendance_no_report',
          staffId,
          staffName,
          projectName,
          shiftDate: today,
          shiftTime: `${startTime}〜${endTime}`,
          message: 'シフト予定あり・打刻なし・日報なし',
        })
      }

      // Type B: 日報あり、打刻なし
      if (!hasAttendance && hasReport) {
        alerts.push({
          type: 'report_no_attendance',
          staffId,
          staffName,
          projectName,
          shiftDate: today,
          shiftTime: `${startTime}〜${endTime}`,
          message: '日報あり・打刻なし',
        })
      }
    }

    return NextResponse.json({ alerts, count: alerts.length })
  } catch (error) {
    console.error('GET /api/alerts/work-status error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
