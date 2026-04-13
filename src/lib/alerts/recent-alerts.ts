import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isOwner, isAdmin, type UserWithRole } from '@/lib/auth/rbac'
import { fetchActiveIgnoreRules, isAlertIgnored } from '@/lib/alerts/ignore-rules'

export type DerivedAlertType =
  | 'ATTENDANCE_ERROR'
  | 'ATTENDANCE_CORRECTION_PENDING'
  | 'REPORT_MISSING'
  | 'REPORT_REJECTED'
  | 'SHIFT_SUBMISSION_DUE'
  | 'EQUIPMENT_PLEDGE_UNSIGNED'
  | 'CALL_NO_SHIFT'
  | 'CALL_NO_ATTENDANCE'
  | 'CALL_NO_REPORT'

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
  SHIFT_SUBMISSION_DUE: 'シフト未提出',
  EQUIPMENT_PLEDGE_UNSIGNED: '貸与品契約未締結',
  CALL_NO_SHIFT: '架電あり・シフトなし',
  CALL_NO_ATTENDANCE: '架電あり・打刻なし',
  CALL_NO_REPORT: '架電あり・日報なし',
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
  options: { limit?: number; lookbackDays?: number; skipIgnoreFilter?: boolean } = {}
): Promise<DerivedAlert[]> {
  const limit = options.limit ?? 20
  const lookbackDays = options.lookbackDays ?? 14
  const supabase = await createServerSupabaseClient()

  const today = todayJstStr()
  // Use JST-based date arithmetic to avoid off-by-one from UTC conversion
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - lookbackDays)
  const fromFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const lookbackStr = fromFmt.format(lookbackDate)

  // Floor to 1st of current month (JST) - don't look back into previous months
  const jstNowForMonth = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const currentMonthFirst = `${jstNowForMonth.getUTCFullYear()}-${String(jstNowForMonth.getUTCMonth() + 1).padStart(2, '0')}-01`

  // Use the later of the two dates
  const fromStr = lookbackStr > currentMonthFirst ? lookbackStr : currentMonthFirst
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
    .select('id, staff_id, project_id, shift_date, start_time, end_time, staff:staff_id(last_name, first_name), project:project_id(id, name, project_type, report_type)')
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
    project: { id: string; name: string; project_type: string | null; report_type?: string | null } | null
  }>

  // staff_idでフィルタ (owner以外)
  const shifts = scopedStaffIds === null
    ? allShifts
    : allShifts.filter((s) => s.staff_id && scopedStaffIds!.includes(s.staff_id))

  // 関連attendance_records をまとめて取得
  const staffIdsInShifts = Array.from(new Set(shifts.map((s) => s.staff_id).filter((x): x is string => !!x)))
  const dateSet = Array.from(new Set(shifts.map((s) => s.shift_date)))

  // Fetch attendance_records and work_reports in parallel (both depend only on staffIdsInShifts + dateSet)
  const attendanceMap = new Map<string, { clock_in: string | null; clock_out: string | null }>()
  const workReportStaffDates = new Set<string>()

  if (staffIdsInShifts.length > 0 && dateSet.length > 0) {
    const [{ data: arData }, { data: wrData }] = await Promise.all([
      supabase
        .from('attendance_records')
        .select('staff_id, date, clock_in, clock_out')
        .in('staff_id', staffIdsInShifts)
        .in('date', dateSet)
        .is('deleted_at', null),
      supabase
        .from('work_reports')
        .select('staff_id, report_date')
        .in('staff_id', staffIdsInShifts)
        .in('report_date', dateSet)
        .is('deleted_at', null),
    ])

    for (const a of (arData || []) as Array<{ staff_id: string; date: string; clock_in: string | null; clock_out: string | null }>) {
      const key = `${a.staff_id}:${a.date}`
      const existing = attendanceMap.get(key)
      if (existing) {
        attendanceMap.set(key, {
          clock_in: existing.clock_in || a.clock_in,
          clock_out: existing.clock_out || a.clock_out,
        })
      } else {
        attendanceMap.set(key, { clock_in: a.clock_in, clock_out: a.clock_out })
      }
    }

    for (const w of (wrData || []) as Array<{ staff_id: string | null; report_date: string | null }>) {
      if (w.staff_id && w.report_date) workReportStaffDates.add(`${w.staff_id}:${w.report_date}`)
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
  // Internal project types that should NOT trigger alerts
  const internalProjectTypes = new Set(['CAN', 'ETC'])
  // Track already-emitted report-missing alerts per staff+date to deduplicate
  const reportMissingEmitted = new Set<string>()

  for (const s of shifts) {
    const staffName = s.staff ? `${s.staff.last_name} ${s.staff.first_name}` : '不明'
    const projectName = s.project?.name || (s.project_id ? projectNameMap.get(s.project_id) || '不明' : '個人')
    const managerName = s.project_id ? projectManagerMap.get(s.project_id) : null

    // Skip internal projects (CAN / ETC) for attendance and report alerts
    const projectType = s.project?.project_type || null
    if (projectType && internalProjectTypes.has(projectType)) continue

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

    // 日報送付漏れ: 終了済みシフトで work_reports に存在しない (staff_id + date 基準, 1日1件に重複排除)
    // report_type 未設定のPJは日報義務なし → スキップ
    const reportKey = `${s.staff_id}:${s.shift_date}`
    if (endPassed && !workReportStaffDates.has(reportKey) && !reportMissingEmitted.has(reportKey) && s.project?.report_type) {
      reportMissingEmitted.add(reportKey)
      let description = `${staffName} / ${projectName} (${s.shift_date}) の日報未提出`
      if (ownerScope && managerName) description += `（管理者: ${managerName}）`
      alerts.push({
        id: `report-missing:${s.staff_id}:${s.shift_date}`,
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

  // --- 貸与品契約未締結 ---
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pledgeQueryBase = (supabase as any)
      .from('equipment_lending_records')
      .select('id, staff_id, lending_date, pledge_status, staff:staff_id(last_name, first_name)')
      .eq('pledge_status', 'not_submitted')
      .is('return_date', null)
      .is('deleted_at', null)
      .limit(100)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pledgeQuery = applyStaffScope(pledgeQueryBase as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pledgeRes = await (pledgeQuery as any)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsignedRecords = ((pledgeRes as any).data || []) as Array<{
      id: string
      staff_id: string | null
      lending_date: string
      pledge_status: string | null
      staff: { last_name: string; first_name: string } | null
    }>

    for (const r of unsignedRecords) {
      const staffName = r.staff ? `${r.staff.last_name} ${r.staff.first_name}` : '不明'
      const description = `${staffName} の貸与品契約が未締結です`

      alerts.push({
        id: `equip-pledge:${r.id}`,
        type: 'EQUIPMENT_PLEDGE_UNSIGNED',
        severity: 'WARNING',
        title: ALERT_TYPE_LABEL.EQUIPMENT_PLEDGE_UNSIGNED,
        message: description,
        description,
        relatedStaffId: r.staff_id,
        relatedStaffName: staffName,
        relatedProjectId: null,
        relatedProjectName: null,
        projectManagerName: null,
        createdAt: `${r.lending_date}T09:00:00+09:00`,
        href: '/equipment',
      })
    }
  } catch (e) {
    console.error('EQUIPMENT_PLEDGE_UNSIGNED calc error:', e)
  }

  // --- テレアポくん架電チェック ---
  try {
    const apiUrl = process.env.CANVI_CALL_API_URL?.trim()
    const apiKey = process.env.CANVI_CALL_API_KEY?.trim()

    if (apiUrl && apiKey) {
      // Call the bulk activity endpoint
      const callRes = await fetch(
        `${apiUrl}/api/external/bulk-activity?from=${fromStr}&to=${today}`,
        {
          headers: { 'X-API-Key': apiKey },
          cache: 'no-store',
          signal: AbortSignal.timeout(10_000),
        }
      )

      if (callRes.ok) {
        const callActivity: Array<{
          email: string
          staffName: string
          date: string
          portalProjectId: string | null
          callProjectName: string
          callCount: number
        }> = await callRes.json()

        // Resolve email → staff_id
        const callEmails = [...new Set(callActivity.map(c => c.email))]
        const emailToStaff = new Map<string, { id: string; name: string }>()
        if (callEmails.length > 0) {
          const { data: staffByEmail } = await supabase
            .from('users')
            .select('email, staff:staff(id, last_name, first_name)')
            .in('email', callEmails)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const u of (staffByEmail || []) as any[]) {
            if (u.staff) {
              emailToStaff.set(u.email, {
                id: u.staff.id,
                name: `${u.staff.last_name} ${u.staff.first_name}`
              })
            }
          }
        }

        // Group call activity by staff+date
        const callDays = new Map<string, { staffId: string; staffName: string; date: string; portalProjectId: string | null; projectName: string; callCount: number }>()
        for (const c of callActivity) {
          const staff = emailToStaff.get(c.email)
          if (!staff) continue
          // scope check
          if (scopedStaffIds !== null && !scopedStaffIds.includes(staff.id)) continue

          const key = `${staff.id}:${c.date}:${c.portalProjectId || 'none'}`
          if (!callDays.has(key)) {
            callDays.set(key, {
              staffId: staff.id,
              staffName: staff.name,
              date: c.date,
              portalProjectId: c.portalProjectId,
              projectName: c.callProjectName || (c.portalProjectId ? projectNameMap.get(c.portalProjectId) || '不明' : '不明'),
              callCount: c.callCount,
            })
          } else {
            callDays.get(key)!.callCount += c.callCount
          }
        }

        // For each call day, check shift/attendance/report
        // Collect all dates and staff_ids
        const callStaffDates = [...callDays.values()]
        const callDateSet = [...new Set(callStaffDates.map(c => c.date))]
        const callStaffIds = [...new Set(callStaffDates.map(c => c.staffId))]

        // Shifts, attendance, and reports by staff+date (parallel)
        const shiftSet = new Set<string>()
        const callAttendanceSet = new Set<string>()
        const callReportSet = new Set<string>()
        if (callStaffIds.length > 0 && callDateSet.length > 0) {
          const [{ data: callShifts }, { data: callAtt }, { data: callReports }] = await Promise.all([
            supabase
              .from('shifts')
              .select('staff_id, shift_date')
              .in('staff_id', callStaffIds)
              .in('shift_date', callDateSet)
              .is('deleted_at', null),
            supabase
              .from('attendance_records')
              .select('staff_id, date')
              .in('staff_id', callStaffIds)
              .in('date', callDateSet)
              .is('deleted_at', null)
              .not('clock_in', 'is', null),
            supabase
              .from('work_reports')
              .select('staff_id, report_date')
              .in('staff_id', callStaffIds)
              .in('report_date', callDateSet)
              .is('deleted_at', null)
              .neq('status', 'draft'),
          ])

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const s of (callShifts || []) as any[]) {
            shiftSet.add(`${s.staff_id}:${s.shift_date}`)
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const a of (callAtt || []) as any[]) {
            callAttendanceSet.add(`${a.staff_id}:${a.date}`)
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const r of (callReports || []) as any[]) {
            callReportSet.add(`${r.staff_id}:${r.report_date}`)
          }
        }

        // Generate alerts
        for (const [, entry] of callDays) {
          const sdKey = `${entry.staffId}:${entry.date}`
          const managerName = entry.portalProjectId ? projectManagerMap.get(entry.portalProjectId) : null
          const baseDesc = `${entry.staffName} / ${entry.projectName} (${entry.date}) - ${entry.callCount}件架電`

          // Check: no shift
          if (!shiftSet.has(sdKey)) {
            let description = `${baseDesc}・シフトなし`
            if (ownerScope && managerName) description += `（管理者: ${managerName}）`
            alerts.push({
              id: `call-no-shift:${entry.staffId}:${entry.date}`,
              type: 'CALL_NO_SHIFT',
              severity: 'WARNING',
              title: ALERT_TYPE_LABEL.CALL_NO_SHIFT,
              message: description,
              description,
              relatedStaffId: entry.staffId,
              relatedStaffName: entry.staffName,
              relatedProjectId: entry.portalProjectId,
              relatedProjectName: entry.projectName,
              projectManagerName: managerName || null,
              createdAt: `${entry.date}T18:00:00+09:00`,
              href: '/shifts',
            })
          }

          // Check: no attendance (only if they DO have a shift - otherwise CALL_NO_SHIFT covers it)
          if (shiftSet.has(sdKey) && !callAttendanceSet.has(sdKey)) {
            let description = `${baseDesc}・打刻なし`
            if (ownerScope && managerName) description += `（管理者: ${managerName}）`
            alerts.push({
              id: `call-no-att:${entry.staffId}:${entry.date}`,
              type: 'CALL_NO_ATTENDANCE',
              severity: 'WARNING',
              title: ALERT_TYPE_LABEL.CALL_NO_ATTENDANCE,
              message: description,
              description,
              relatedStaffId: entry.staffId,
              relatedStaffName: entry.staffName,
              relatedProjectId: entry.portalProjectId,
              relatedProjectName: entry.projectName,
              projectManagerName: managerName || null,
              createdAt: `${entry.date}T18:00:00+09:00`,
              href: '/attendance',
            })
          }

          // Check: no report
          if (!callReportSet.has(sdKey)) {
            let description = `${baseDesc}・日報なし`
            if (ownerScope && managerName) description += `（管理者: ${managerName}）`
            alerts.push({
              id: `call-no-report:${entry.staffId}:${entry.date}`,
              type: 'CALL_NO_REPORT',
              severity: 'WARNING',
              title: ALERT_TYPE_LABEL.CALL_NO_REPORT,
              message: description,
              description,
              relatedStaffId: entry.staffId,
              relatedStaffName: entry.staffName,
              relatedProjectId: entry.portalProjectId,
              relatedProjectName: entry.projectName,
              projectManagerName: managerName || null,
              createdAt: `${entry.date}T18:00:00+09:00`,
              href: '/reports/work/new',
            })
          }
        }
      }
    }
  } catch (e) {
    console.error('CALL_ACTIVITY check error:', e)
  }

  // --- 翌月シフト未提出 (毎月26日以降) ---
  try {
    const [ty, tm, td] = today.split('-').map((n) => parseInt(n, 10))
    if (td >= 26) {
      // 翌月の年月
      const nextY = tm === 12 ? ty + 1 : ty
      const nextM = tm === 12 ? 1 : tm + 1
      const nextMonthStart = `${nextY}-${String(nextM).padStart(2, '0')}-01`
      const lastDay = new Date(nextY, nextM, 0).getDate()
      const nextMonthEnd = `${nextY}-${String(nextM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      // 対象スタッフIDを解決
      let targetStaffIds: string[] = []
      if (scopedStaffIds === null) {
        // owner: 全スタッフ
        const { data: allStaff } = await supabase
          .from('staff')
          .select('id')
          .is('deleted_at', null)
        targetStaffIds = ((allStaff || []) as Array<{ id: string }>).map((s) => s.id)
      } else {
        targetStaffIds = scopedStaffIds
      }

      if (targetStaffIds.length > 0) {
        // 翌月内にシフトを持つ staff_id を取得
        const { data: nextShifts } = await supabase
          .from('shifts')
          .select('staff_id')
          .in('staff_id', targetStaffIds)
          .gte('shift_date', nextMonthStart)
          .lte('shift_date', nextMonthEnd)
          .is('deleted_at', null)
        const submitted = new Set<string>()
        for (const s of (nextShifts || []) as Array<{ staff_id: string | null }>) {
          if (s.staff_id) submitted.add(s.staff_id)
        }
        const missingStaffIds = targetStaffIds.filter((id) => !submitted.has(id))

        if (missingStaffIds.length > 0) {
          // 名前解決
          const { data: staffNames } = await supabase
            .from('staff')
            .select('id, last_name, first_name')
            .in('id', missingStaffIds)
          const nameMap = new Map<string, string>()
          for (const s of (staffNames || []) as Array<{ id: string; last_name: string; first_name: string }>) {
            nameMap.set(s.id, `${s.last_name} ${s.first_name}`)
          }

          // owner向けに各スタッフのPJ管理者名を解決
          const staffManagerMap = new Map<string, string>()
          if (ownerScope) {
            const { data: assigns } = await supabase
              .from('project_assignments')
              .select('staff_id, project_id')
              .in('staff_id', missingStaffIds)
              .is('deleted_at', null)
            const pidSet = new Set<string>()
            const staffToPids = new Map<string, string[]>()
            for (const a of (assigns || []) as Array<{ staff_id: string; project_id: string }>) {
              if (!a.project_id) continue
              pidSet.add(a.project_id)
              const arr = staffToPids.get(a.staff_id) || []
              arr.push(a.project_id)
              staffToPids.set(a.staff_id, arr)
            }
            if (pidSet.size > 0) {
              const pidArr = Array.from(pidSet)
              // 不足分のプロジェクト名取得
              const missingPids = pidArr.filter((p) => !projectNameMap.has(p))
              if (missingPids.length > 0) {
                const { data: pjs } = await supabase
                  .from('projects')
                  .select('id, name')
                  .in('id', missingPids)
                for (const p of (pjs || []) as Array<{ id: string; name: string }>) {
                  projectNameMap.set(p.id, p.name)
                }
              }
              const missingMgrPids = pidArr.filter((p) => !projectManagerMap.has(p))
              if (missingMgrPids.length > 0) {
                const { data: mgrData } = await supabase
                  .from('project_assignments')
                  .select('project_id, role_title, staff:staff_id(last_name, first_name)')
                  .in('project_id', missingMgrPids)
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
            for (const [sid, pids] of staffToPids.entries()) {
              const names = pids
                .map((p) => projectManagerMap.get(p))
                .filter((x): x is string => !!x)
              if (names.length > 0) {
                staffManagerMap.set(sid, Array.from(new Set(names)).join(', '))
              }
            }
          }

          const nextLabel = `${nextY}年${nextM}月`
          for (const sid of missingStaffIds) {
            const staffName = nameMap.get(sid) || '不明'
            let description = `${staffName} - ${nextLabel}分のシフト未提出`
            if (ownerScope) {
              const mgr = staffManagerMap.get(sid)
              if (mgr) description += `（管理者: ${mgr}）`
            }
            alerts.push({
              id: `shift-due:${sid}:${nextY}${String(nextM).padStart(2, '0')}`,
              type: 'SHIFT_SUBMISSION_DUE',
              severity: 'WARNING',
              title: ALERT_TYPE_LABEL.SHIFT_SUBMISSION_DUE,
              message: description,
              description,
              relatedStaffId: sid,
              relatedStaffName: staffName,
              relatedProjectId: null,
              relatedProjectName: null,
              projectManagerName: ownerScope ? (staffManagerMap.get(sid) || null) : null,
              createdAt: `${today}T09:00:00+09:00`,
              href: '/shifts?openBulk=1',
            })
          }
        }
      }
    }
  } catch (e) {
    console.error('SHIFT_SUBMISSION_DUE calc error:', e)
  }

  // 無視ルールで除外（skipIgnoreFilter指定時はスキップ）
  let filteredAlerts = alerts
  if (!options.skipIgnoreFilter) {
    const ignoreRules = await fetchActiveIgnoreRules()
    if (ignoreRules.length > 0) {
      filteredAlerts = alerts.filter((a) => !isAlertIgnored(ignoreRules, a.type, a.relatedStaffId, a.relatedProjectId))
    }
  }

  // 新しい順ソート
  filteredAlerts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return filteredAlerts.slice(0, limit)
}
