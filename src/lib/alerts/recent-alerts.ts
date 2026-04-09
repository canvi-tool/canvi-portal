import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isOwner, isAdmin, type UserWithRole } from '@/lib/auth/rbac'

export type DerivedAlertType =
  | 'ATTENDANCE_ERROR'
  | 'ATTENDANCE_CORRECTION_PENDING'
  | 'REPORT_MISSING'
  | 'REPORT_REJECTED'

export interface DerivedAlert {
  id: string
  type: DerivedAlertType
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  title: string
  message: string
  description: string
  relatedStaffId?: string | null
  relatedStaffName?: string | null
  relatedProjectId?: string | null
  relatedProjectName?: string | null
  projectManagerName?: string | null
  createdAt: string
  href?: string
}

const ALERT_TYPE_LABEL: Record<DerivedAlertType, string> = {
  ATTENDANCE_ERROR: '勤怠エラー',
  ATTENDANCE_CORRECTION_PENDING: '勤怠修正依頼',
  REPORT_MISSING: '日報送付漏れ',
  REPORT_REJECTED: '日報差戻し',
}

function todayJstStr(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}

function nowJstHHmm(): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return fmt.format(new Date())
}

/**
 * 指定ユーザー・ロールのスコープで、派生アラート（勤怠/日報系）を取得する。
 *
 * スコープ:
 *  - owner: 全メンバー + 自身（管理者名を付記）
 *  - admin: 自分が参画するPJのメンバー + 自身
 *  - staff: 自分のみ
 */
export async function getRecentDerivedAlerts(
  user: UserWithRole,
  allowedProjectIds: string[] | null,
  options: { limit?: number; lookbackDays?: number } = {}
): Promise<DerivedAlert[]> {
  const limit = options.limit ?? 20
  const lookbackDays = options.lookbackDays ?? 14
  const supabase = await createServerSupabaseClient()

  const today = todayJstStr()
  const from = new Date()
  from.setDate(from.getDate() - lookbackDays)
  const fromStr = from.toISOString().slice(0, 10)
  const nowHHmm = nowJstHHmm()

  const ownerScope = isOwner(user)
  const adminScope = !ownerScope && isAdmin(user)
  // staffScope = それ以外
  const selfStaffId = user.staffId

  // スコープ対象のstaff_idを決定
  let scopedStaffIds: string[] | null = null // null = 全員 (owner)
  if (!ownerScope) {
    const ids = new Set<string>()
    if (selfStaffId) ids.add(selfStaffId)
    if (adminScope && allowedProjectIds && allowedProjectIds.length > 0) {
      const { data: members } = await supabase
        .from('project_assignments')
        .select('staff_id')
        .in('project_id', allowedProjectIds)
        .is('deleted_at', null)
      for (const m of (members || []) as Array<{ staff_id: string }>) {
        if (m.staff_id) ids.add(m.staff_id)
      }
    }
    scopedStaffIds = Array.from(ids)
    if (scopedStaffIds.length === 0) return []
  }

  // 共通: scoped staff filter helper
  const applyStaffScope = <T extends { in: (col: string, vals: string[]) => T }>(
    q: T,
    col = 'staff_id'
  ): T => {
    if (scopedStaffIds === null) return q
    return q.in(col, scopedStaffIds)
  }

  // --- 並列取得 ---
  // 1) 勤怠エラー: shift_date in [from, today] で AND (
  //      (終了時刻 <= 現在 AND clock_out なし) OR
  //      (開始時刻 <= 現在 AND clock_in なし)
  //    )
  //    シンプル化: 過去日で clock_in または clock_out NULL のシフト。今日は end_time <= 現在のもののみ。
  const shiftsQueryBase = supabase
    .from('shifts')
    .select('id, staff_id, project_id, shift_date, start_time, end_time, staff:staff_id(last_name, first_name), project:project_id(id, name)')
    .gte('shift_date', fromStr)
    .lte('shift_date', today)
    .is('deleted_at', null)
    .neq('status', 'REJECTED' as 'SUBMITTED')
    .limit(200)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shiftsQuery = applyStaffScope(shiftsQueryBase as any)
  if (allowedProjectIds !== null) {
    if (allowedProjectIds.length === 0 && ownerScope === false) {
      // 管理者でPJなし: 自分のシフトのみ (staff_idスコープで既にカバー)
    } else if (allowedProjectIds.length > 0) {
      // allowed限定はしない（自分のシフトは project_id が null の可能性あり）
      // staff_idスコープで十分
    }
  }

  // 2) 勤怠修正依頼
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const correctionsQueryBase = (supabase as any)
    .from('attendance_correction_requests')
    .select('id, requested_by_user_id, project_id, created_at, reason, status, attendance_record_id')
    .eq('status', 'pending')
    .gte('created_at', fromStr)
    .order('created_at', { ascending: false })
    .limit(100)

  // 3) 日報差戻し
  const rejectedReportsQueryBase = supabase
    .from('work_reports')
    .select('id, staff_id, project_id, report_date, status, reviewed_at, review_comment, updated_at, staff:staff_id(last_name, first_name), project:project_id(id, name)')
    .eq('status', 'rejected')
    .gte('report_date', fromStr)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(100)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rejectedReportsQuery = applyStaffScope(rejectedReportsQueryBase as any)

  // 4) 日報送付漏れ: 過去のシフトで work_reports が存在しないもの
  //    → shiftsQueryの結果と work_reports を突合

  const [shiftsRes, correctionsRes, rejectedReportsRes] = await Promise.all([
    shiftsQuery,
    correctionsQueryBase,
    rejectedReportsQuery,
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allShifts = ((shiftsRes as any).data || []) as Array<{
    id: string
    staff_id: string | null
    project_id: string | null
    shift_date: string
    start_time: string | null
    end_time: string | null
    staff: { last_name: string; first_name: string } | null
    project: { id: string; name: string } | null
  }>

  // staff_idでフィルタ (owner以外)
  const shifts = scopedStaffIds === null
    ? allShifts
    : allShifts.filter((s) => s.staff_id && scopedStaffIds!.includes(s.staff_id))

  // 関連attendance_records をまとめて取得
  const staffIdsInShifts = Array.from(new Set(shifts.map((s) => s.staff_id).filter((x): x is string => !!x)))
  const dateSet = Array.from(new Set(shifts.map((s) => s.shift_date)))

  let attendanceMap = new Map<string, { clock_in: string | null; clock_out: string | null }>()
  if (staffIdsInShifts.length > 0 && dateSet.length > 0) {
    const { data: arData } = await supabase
      .from('attendance_records')
      .select('staff_id, date, clock_in, clock_out')
      .in('staff_id', staffIdsInShifts)
      .in('date', dateSet)
      .is('deleted_at', null)
    for (const a of (arData || []) as Array<{ staff_id: string; date: string; clock_in: string | null; clock_out: string | null }>) {
      attendanceMap.set(`${a.staff_id}:${a.date}`, { clock_in: a.clock_in, clock_out: a.clock_out })
    }
  }

  // work_reportsの存在をまとめて取得 (shift_id 基準)
  const shiftIds = shifts.map((s) => s.id)
  const workReportShiftIds = new Set<string>()
  if (shiftIds.length > 0) {
    const { data: wrData } = await supabase
      .from('work_reports')
      .select('shift_id')
      .in('shift_id', shiftIds)
      .is('deleted_at', null)
    for (const w of (wrData || []) as unknown as Array<{ shift_id: string | null }>) {
      if (w.shift_id) workReportShiftIds.add(w.shift_id)
    }
  }

  // correctionsを staff_id に解決するため user_id → staff_id マップを取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const corrections = ((correctionsRes as any).data || []) as Array<{
    id: string
    requested_by_user_id: string | null
    project_id: string | null
    created_at: string
    reason: string | null
    attendance_record_id: string | null
  }>
  const reqUserIds = Array.from(new Set(corrections.map((c) => c.requested_by_user_id).filter((x): x is string => !!x)))
  const userToStaff = new Map<string, { id: string; name: string }>()
  if (reqUserIds.length > 0) {
    const { data: staffData } = await supabase
      .from('staff')
      .select('id, user_id, last_name, first_name')
      .in('user_id', reqUserIds)
    for (const s of (staffData || []) as Array<{ id: string; user_id: string; last_name: string; first_name: string }>) {
      userToStaff.set(s.user_id, { id: s.id, name: `${s.last_name} ${s.first_name}` })
    }
  }

  // rejected reports
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rejectedReports = ((rejectedReportsRes as any).data || []) as Array<{
    id: string
    staff_id: string | null
    project_id: string | null
    report_date: string
    updated_at: string
    review_comment: string | null
    staff: { last_name: string; first_name: string } | null
    project: { id: string; name: string } | null
  }>

  // プロジェクトID集合を作って、プロジェクト名と管理者名をまとめて解決 (ownerのみ管理者名必要)
  const projectIds = new Set<string>()
  shifts.forEach((s) => { if (s.project_id) projectIds.add(s.project_id) })
  corrections.forEach((c) => { if (c.project_id) projectIds.add(c.project_id) })
  rejectedReports.forEach((r) => { if (r.project_id) projectIds.add(r.project_id) })

  const projectNameMap = new Map<string, string>()
  const projectManagerMap = new Map<string, string>() // projectId -> manager name(s)

  if (projectIds.size > 0) {
    const pidArr = Array.from(projectIds)
    const { data: projData } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', pidArr)
    for (const p of (projData || []) as Array<{ id: string; name: string }>) {
      projectNameMap.set(p.id, p.name)
    }

    if (ownerScope) {
      // 管理者 = role_title に "管理" を含む or "manager" のプロジェクトメンバー
      const { data: mgrData } = await supabase
        .from('project_assignments')
        .select('project_id, role_title, staff:staff_id(last_name, first_name)')
        .in('project_id', pidArr)
        .is('deleted_at', null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const a of (mgrData || []) as any[]) {
        const rt = (a.role_title || '') as string
        if (!rt) continue
        const isMgr = rt.includes('管理') || /manager/i.test(rt) || rt.includes('マネージャ') || rt.includes('リーダー') || rt.includes('PM')
        if (!isMgr) continue
        const name = a.staff ? `${a.staff.last_name} ${a.staff.first_name}` : null
        if (!name) continue
        const prev = projectManagerMap.get(a.project_id)
        projectManagerMap.set(a.project_id, prev ? `${prev}, ${name}` : name)
      }
    }
  }

  const alerts: DerivedAlert[] = []

  // --- 勤怠エラー & 日報送付漏れ（シフトを一巡） ---
  for (const s of shifts) {
    const staffName = s.staff ? `${s.staff.last_name} ${s.staff.first_name}` : '不明'
    const projectName = s.project?.name || (s.project_id ? projectNameMap.get(s.project_id) || '不明' : '個人')
    const managerName = s.project_id ? projectManagerMap.get(s.project_id) : null

    const key = `${s.staff_id}:${s.shift_date}`
    const ar = attendanceMap.get(key)

    // 勤怠エラー判定
    const isPastDate = s.shift_date < today
    const isToday = s.shift_date === today
    const endTime = (s.end_time || '').slice(0, 5)
    const startTime = (s.start_time || '').slice(0, 5)

    const endPassed = isPastDate || (isToday && endTime && endTime <= nowHHmm)
    const startPassed = isPastDate || (isToday && startTime && startTime <= nowHHmm)

    const missingClockIn = startPassed && (!ar || !ar.clock_in)
    const missingClockOut = endPassed && (!ar || !ar.clock_out)

    if (missingClockIn || missingClockOut) {
      const parts: string[] = []
      if (missingClockIn) parts.push('出勤打刻なし')
      if (missingClockOut) parts.push('退勤打刻なし')
      let description = `${staffName} / ${projectName} (${s.shift_date}) - ${parts.join('・')}`
      if (ownerScope && managerName) description += `（管理者: ${managerName}）`
      alerts.push({
        id: `attn-err:${s.id}`,
        type: 'ATTENDANCE_ERROR',
        severity: 'WARNING',
        title: ALERT_TYPE_LABEL.ATTENDANCE_ERROR,
        message: description,
        description,
        relatedStaffId: s.staff_id,
        relatedStaffName: staffName,
        relatedProjectId: s.project_id,
        relatedProjectName: projectName,
        projectManagerName: managerName || null,
        createdAt: `${s.shift_date}T${endTime || '23:59'}:00+09:00`,
        href: '/attendance',
      })
    }

    // 日報送付漏れ: 終了済みシフトで work_reports に存在しない
    if (endPassed && !workReportShiftIds.has(s.id)) {
      let description = `${staffName} / ${projectName} (${s.shift_date}) の日報未提出`
      if (ownerScope && managerName) description += `（管理者: ${managerName}）`
      alerts.push({
        id: `report-missing:${s.id}`,
        type: 'REPORT_MISSING',
        severity: 'WARNING',
        title: ALERT_TYPE_LABEL.REPORT_MISSING,
        message: description,
        description,
        relatedStaffId: s.staff_id,
        relatedStaffName: staffName,
        relatedProjectId: s.project_id,
        relatedProjectName: projectName,
        projectManagerName: managerName || null,
        createdAt: `${s.shift_date}T${endTime || '23:59'}:00+09:00`,
        href: '/reports/work/new',
      })
    }
  }

  // --- 勤怠修正依頼 ---
  for (const c of corrections) {
    const staffInfo = c.requested_by_user_id ? userToStaff.get(c.requested_by_user_id) : null
    const staffId = staffInfo?.id || null
    const staffName = staffInfo?.name || '不明'

    // スコープ適用
    if (scopedStaffIds !== null) {
      if (!staffId || !scopedStaffIds.includes(staffId)) continue
    }

    const projectName = c.project_id ? projectNameMap.get(c.project_id) || '不明' : '個人'
    const managerName = c.project_id ? projectManagerMap.get(c.project_id) : null

    let description = `${staffName} / ${projectName} - ${c.reason || '勤怠修正申請中'}`
    if (ownerScope && managerName) description += `（管理者: ${managerName}）`

    alerts.push({
      id: `attn-corr:${c.id}`,
      type: 'ATTENDANCE_CORRECTION_PENDING',
      severity: 'INFO',
      title: ALERT_TYPE_LABEL.ATTENDANCE_CORRECTION_PENDING,
      message: description,
      description,
      relatedStaffId: staffId,
      relatedStaffName: staffName,
      relatedProjectId: c.project_id,
      relatedProjectName: projectName,
      projectManagerName: managerName || null,
      createdAt: c.created_at,
      href: '/attendance/corrections',
    })
  }

  // --- 日報差戻し ---
  for (const r of rejectedReports) {
    const staffName = r.staff ? `${r.staff.last_name} ${r.staff.first_name}` : '不明'
    const projectName = r.project?.name || (r.project_id ? projectNameMap.get(r.project_id) || '不明' : '個人')
    const managerName = r.project_id ? projectManagerMap.get(r.project_id) : null

    let description = `${staffName} / ${projectName} (${r.report_date}) ${r.review_comment ? '- ' + r.review_comment : 'の日報が差戻されました'}`
    if (ownerScope && managerName) description += `（管理者: ${managerName}）`

    alerts.push({
      id: `report-rej:${r.id}`,
      type: 'REPORT_REJECTED',
      severity: 'CRITICAL',
      title: ALERT_TYPE_LABEL.REPORT_REJECTED,
      message: description,
      description,
      relatedStaffId: r.staff_id,
      relatedStaffName: staffName,
      relatedProjectId: r.project_id,
      relatedProjectName: projectName,
      projectManagerName: managerName || null,
      createdAt: r.updated_at,
      href: `/reports/work/${r.id}`,
    })
  }

  // 新しい順ソート
  alerts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return alerts.slice(0, limit)
}
