/**
 * 報酬計算エンジン (Phase 2)
 *
 * 前提:
 * - スタッフは users.compensation_type を持つ（MONTHLY/HOURLY/DAILY/PER_UNIT/REVENUE_SHARE/COMMISSION）
 * - PJ別に project_member_compensations で上書き可能（履歴は effective_from/to で管理）
 * - 月給スタッフの時間単価は「その月の実稼働合計で動的に割り戻す」(Q3 = 案A)
 * - 生産性指標 (架電件数/アポ獲得/成約/売上) は work_reports.custom_fields から拾う
 */
import { createAdminClient } from '@/lib/supabase/admin'

export type CompensationType =
  | 'MONTHLY'
  | 'HOURLY'
  | 'DAILY'
  | 'PER_UNIT'
  | 'REVENUE_SHARE'
  | 'COMMISSION'

export interface BonusRule {
  threshold: number     // 累計件数 or 累計売上 の閾値
  rate_amount: number   // 閾値超過分への単価/率
}

export interface ProjectCompensation {
  staff_id: string
  project_id: string
  rate_type: CompensationType
  rate_amount: number
  unit_label: string | null
  bonus_rules: BonusRule[]
  effective_from: string
  effective_to: string | null
}

export interface StaffBaseCompensation {
  compensation_type: CompensationType | null
  base_monthly_amount: number | null
  base_hourly_amount: number | null
  base_daily_amount: number | null
}

export interface ShiftSlim {
  id: string
  staff_id: string
  project_id: string
  shift_date: string  // YYYY-MM-DD
  start_time: string  // HH:MM:SS
  end_time: string    // HH:MM:SS
}

export interface DailyReportMetrics {
  report_date: string
  staff_id: string
  project_id: string | null
  num_calls: number
  num_appointments: number
  num_closings: number
  revenue: number
}

export interface StaffMonthlyCost {
  staff_id: string
  month: string         // YYYY-MM
  total_hours: number   // 全PJ合計の稼働時間
  total_cost: number    // 全PJ合計の人件費
  byProject: {
    project_id: string
    hours: number
    cost: number
    rate_type: CompensationType
    note: string
  }[]
}

/** HH:MM:SS を分に */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** シフトの所要時間(分)。日跨ぎ対応 */
function shiftMinutes(s: ShiftSlim): number {
  const start = timeToMinutes(s.start_time)
  let end = timeToMinutes(s.end_time)
  if (end <= start) end += 24 * 60
  return end - start
}

/**
 * 指定月の該当スタッフの人件費を算出
 *
 * ロジック:
 * - 月内シフトを取得 → staff×projectで時間合計
 * - PJ別の project_member_compensations を優先、なければ users の基本報酬
 * - MONTHLY  : 月給 × (PJ別時間 / 全PJ合計時間) で按分
 * - HOURLY   : 時給 × PJ別時間
 * - DAILY    : 日給 × 稼働日数
 * - PER_UNIT : 件数 × 単価 (work_reports.custom_fields.num_calls 等から合算)
 * - REVENUE_SHARE: 売上 × rate_amount(%) / 100
 * - COMMISSION   : bonus_rules を段階適用
 */
export async function computeStaffMonthlyCost(params: {
  staffId: string
  userId: string  // users.id (staffに紐づく)
  year: number
  month: number   // 1-12
}): Promise<StaffMonthlyCost> {
  const { staffId, userId, year, month } = params
  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const firstDay = `${monthStr}-01`
  const lastDay = new Date(year, month, 0).toISOString().slice(0, 10)

  const admin = createAdminClient()

  // 1. 当月シフト取得 (manual + google_calendar昇格済み)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shiftRows } = await (admin as any)
    .from('shifts')
    .select('id, staff_id, project_id, shift_date, start_time, end_time')
    .eq('staff_id', staffId)
    .gte('shift_date', firstDay)
    .lte('shift_date', lastDay)
    .is('deleted_at', null) as { data: ShiftSlim[] | null }
  const shifts: ShiftSlim[] = shiftRows || []

  // 2. PJ別時間集計
  const hoursByProject = new Map<string, number>()
  const daysByProject = new Map<string, Set<string>>()
  for (const s of shifts) {
    if (!s.project_id) continue
    const h = shiftMinutes(s) / 60
    hoursByProject.set(s.project_id, (hoursByProject.get(s.project_id) || 0) + h)
    const set = daysByProject.get(s.project_id) || new Set<string>()
    set.add(s.shift_date)
    daysByProject.set(s.project_id, set)
  }
  const totalHours = Array.from(hoursByProject.values()).reduce((a, b) => a + b, 0)

  // 3. 基本報酬取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: baseRow } = await (admin as any)
    .from('users')
    .select('compensation_type, base_monthly_amount, base_hourly_amount, base_daily_amount')
    .eq('id', userId)
    .maybeSingle() as { data: StaffBaseCompensation | null }
  const base: StaffBaseCompensation = baseRow || {
    compensation_type: null,
    base_monthly_amount: null,
    base_hourly_amount: null,
    base_daily_amount: null,
  }

  // 4. PJ別上書き取得（月内でeffective）
  const projectIds = Array.from(hoursByProject.keys())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pmcRows } = await (admin as any)
    .from('project_member_compensations')
    .select('*')
    .eq('staff_id', staffId)
    .in('project_id', projectIds.length > 0 ? projectIds : ['00000000-0000-0000-0000-000000000000'])
    .lte('effective_from', lastDay)
    .or(`effective_to.is.null,effective_to.gte.${firstDay}`) as { data: ProjectCompensation[] | null }
  const pmcMap = new Map<string, ProjectCompensation>()
  for (const p of pmcRows || []) {
    // 複数該当する場合は最新のeffective_fromを採用
    const prev = pmcMap.get(p.project_id)
    if (!prev || prev.effective_from < p.effective_from) pmcMap.set(p.project_id, p)
  }

  // 5. 生産性指標（work_reports.custom_fields）を集計
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reportRows } = await (admin as any)
    .from('work_reports')
    .select('report_date, staff_id, project_id, custom_fields')
    .eq('staff_id', staffId)
    .gte('report_date', firstDay)
    .lte('report_date', lastDay)
    .is('deleted_at', null)
  const metricsByProject = new Map<string, DailyReportMetrics>()
  for (const r of (reportRows || []) as Array<{
    report_date: string
    staff_id: string
    project_id: string | null
    custom_fields: Record<string, unknown> | null
  }>) {
    const pid = r.project_id || '__none__'
    const cf = r.custom_fields || {}
    const acc = metricsByProject.get(pid) || {
      report_date: r.report_date,
      staff_id: r.staff_id,
      project_id: r.project_id,
      num_calls: 0,
      num_appointments: 0,
      num_closings: 0,
      revenue: 0,
    }
    acc.num_calls += Number(cf.num_calls || 0)
    acc.num_appointments += Number(cf.num_appointments || 0)
    acc.num_closings += Number(cf.num_closings || 0)
    acc.revenue += Number(cf.revenue || 0)
    metricsByProject.set(pid, acc)
  }

  // 6. PJ別コスト算出
  const byProject: StaffMonthlyCost['byProject'] = []
  let totalCost = 0

  for (const [projectId, hours] of hoursByProject.entries()) {
    const override = pmcMap.get(projectId)
    const rateType: CompensationType | null = override?.rate_type || base.compensation_type
    if (!rateType) {
      byProject.push({ project_id: projectId, hours, cost: 0, rate_type: 'HOURLY', note: '報酬種別未設定' })
      continue
    }

    let cost = 0
    let note = ''
    const days = daysByProject.get(projectId)?.size || 0
    const metrics = metricsByProject.get(projectId)

    switch (rateType) {
      case 'MONTHLY': {
        const monthly = override?.rate_amount ?? base.base_monthly_amount ?? 0
        // Q3=案A: その月の実稼働合計で割り戻して按分
        if (totalHours > 0) {
          cost = monthly * (hours / totalHours)
          note = `月給 ${monthly.toLocaleString()}円 × (${hours.toFixed(1)}h / ${totalHours.toFixed(1)}h)`
        } else {
          cost = 0
          note = '稼働時間なし'
        }
        break
      }
      case 'HOURLY': {
        const hourly = override?.rate_amount ?? base.base_hourly_amount ?? 0
        cost = hourly * hours
        note = `時給 ${hourly.toLocaleString()}円 × ${hours.toFixed(1)}h`
        break
      }
      case 'DAILY': {
        const daily = override?.rate_amount ?? base.base_daily_amount ?? 0
        cost = daily * days
        note = `日給 ${daily.toLocaleString()}円 × ${days}日`
        break
      }
      case 'PER_UNIT': {
        const unitPrice = override?.rate_amount ?? 0
        const label = override?.unit_label || 'num_calls'
        // ラベル名でmetrics参照
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const count = Number((metrics as any)?.[label] ?? metrics?.num_calls ?? 0)
        cost = unitPrice * count
        note = `${unitPrice.toLocaleString()}円 × ${count}件(${label})`
        break
      }
      case 'REVENUE_SHARE': {
        const pct = override?.rate_amount ?? 0
        const revenue = metrics?.revenue || 0
        cost = revenue * (pct / 100)
        note = `売上 ${revenue.toLocaleString()}円 × ${pct}%`
        break
      }
      case 'COMMISSION': {
        // bonus_rules 段階歩合: thresholdを超えた部分に対し rate_amount を適用
        const rules = (override?.bonus_rules || []).slice().sort((a, b) => a.threshold - b.threshold)
        const count = metrics?.num_closings || metrics?.num_appointments || 0
        let remaining = count
        let prevThreshold = 0
        for (const r of rules) {
          const band = Math.max(0, Math.min(remaining, r.threshold - prevThreshold))
          cost += band * r.rate_amount
          remaining -= band
          prevThreshold = r.threshold
          if (remaining <= 0) break
        }
        if (remaining > 0 && rules.length > 0) {
          cost += remaining * rules[rules.length - 1].rate_amount
        }
        note = `コミッション ${rules.length}段階 / ${count}件`
        break
      }
    }

    byProject.push({ project_id: projectId, hours, cost, rate_type: rateType, note })
    totalCost += cost
  }

  return {
    staff_id: staffId,
    month: monthStr,
    total_hours: totalHours,
    total_cost: totalCost,
    byProject,
  }
}
