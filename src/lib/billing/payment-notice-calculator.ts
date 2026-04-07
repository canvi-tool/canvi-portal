/**
 * 支払通知書 計算エンジン (PJ単位)
 *
 * 要件: docs/REQUIREMENTS_BILLING.md
 * - シフト実績 + project_member_compensations.bonus_rules から計算
 * - 源泉徴収なし
 * - 交通費は手入力
 * - FS成果報酬は「売上：◯◯×料率」表記
 * - マイナス調整金対応
 * - 内訳: 10%対象(税抜)/10%消費税/0%対象
 * - PJごとに別発行
 */

import { createAdminClient } from '@/lib/supabase/admin'

export type NoticeUnit = '時間' | '個' | '件' | '日' | 'ヵ月' | '式'

export interface NoticeLineDraft {
  rule_type: string
  description: string
  quantity: number
  unit: NoticeUnit
  unit_price: number | null
  amount: number
  is_taxable: boolean
  formula_text?: string | null
  sort_order: number
}

export interface TransportEntry {
  date: string
  route: string
  amount: number
}

export interface PaymentNoticeInput {
  staff_id: string
  user_id: string
  project_id: string
  period_start: string
  period_end: string
  transportation_entries?: TransportEntry[]
  allowance_amount?: number
  adjustment_amount?: number
  adjustment_note?: string
  subject?: string
  recipient_name?: string
  recipient_honorific?: '様' | '御中'
  issue_date?: string
  payment_due_date?: string
  notes?: string
}

export interface PaymentNoticeCalculation {
  project_id: string
  staff_id: string
  period_start: string
  period_end: string
  lines: NoticeLineDraft[]
  taxable_amount_10: number
  tax_amount_10: number
  non_taxable_amount: number
  transportation_amount: number
  allowance_amount: number
  gross_amount: number
  total_amount: number
  subject: string
  recipient_name: string
  recipient_honorific: '様' | '御中'
  issue_date: string
  payment_due_date: string
  payment_method: string
  notes: string
}

export interface BonusRule {
  threshold: number
  rate_amount: number
}

interface ProjectMemberCompensationRow {
  staff_id: string
  project_id: string
  rate_type:
    | 'MONTHLY'
    | 'HOURLY'
    | 'DAILY'
    | 'PER_UNIT'
    | 'REVENUE_SHARE'
    | 'COMMISSION'
  rate_amount: number
  unit_label: string | null
  bonus_rules: BonusRule[] | null
  effective_from: string
  effective_to: string | null
}

interface ShiftRow {
  id: string
  staff_id: string
  project_id: string | null
  shift_date: string
  start_time: string
  end_time: string
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function shiftMinutes(s: ShiftRow): number {
  const start = timeToMinutes(s.start_time)
  let end = timeToMinutes(s.end_time)
  if (end <= start) end += 24 * 60
  return end - start
}

function jpMoney(n: number): string {
  return `¥${Math.floor(n).toLocaleString('ja-JP')}`
}

function lastDayOfMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

export async function calculatePaymentNotice(
  input: PaymentNoticeInput
): Promise<PaymentNoticeCalculation> {
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shiftRows } = await (admin as any)
    .from('shifts')
    .select('id, staff_id, project_id, shift_date, start_time, end_time')
    .eq('staff_id', input.staff_id)
    .eq('project_id', input.project_id)
    .gte('shift_date', input.period_start)
    .lte('shift_date', input.period_end)
    .is('deleted_at', null)

  const shifts: ShiftRow[] = shiftRows ?? []
  const totalMinutes = shifts.reduce((acc, s) => acc + shiftMinutes(s), 0)
  const totalHours = totalMinutes / 60
  const uniqueDays = new Set(shifts.map((s) => s.shift_date)).size

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pmcRows } = await (admin as any)
    .from('project_member_compensations')
    .select('*')
    .eq('staff_id', input.staff_id)
    .eq('project_id', input.project_id)
    .lte('effective_from', input.period_end)
    .or(`effective_to.is.null,effective_to.gte.${input.period_start}`)
    .order('effective_from', { ascending: false })
    .limit(1)

  const pmc: ProjectMemberCompensationRow | null = (pmcRows ?? [])[0] ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reportRows } = await (admin as any)
    .from('work_reports')
    .select('custom_fields')
    .eq('staff_id', input.staff_id)
    .eq('project_id', input.project_id)
    .gte('report_date', input.period_start)
    .lte('report_date', input.period_end)
    .is('deleted_at', null)

  const metrics = { num_calls: 0, num_appointments: 0, num_closings: 0, revenue: 0 }
  for (const r of (reportRows ?? []) as Array<{
    custom_fields: Record<string, unknown> | null
  }>) {
    const cf = r.custom_fields ?? {}
    metrics.num_calls += Number(cf.num_calls || 0)
    metrics.num_appointments += Number(cf.num_appointments || 0)
    metrics.num_closings += Number(cf.num_closings || 0)
    metrics.revenue += Number(cf.revenue || 0)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projectRow } = await (admin as any)
    .from('projects')
    .select('id, name')
    .eq('id', input.project_id)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: staffRow } = await (admin as any)
    .from('staff')
    .select('id, last_name, first_name')
    .eq('id', input.staff_id)
    .maybeSingle()

  const lines: NoticeLineDraft[] = []
  let sort = 0

  if (!pmc) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userRow } = await (admin as any)
      .from('users')
      .select('compensation_type, base_monthly_amount, base_hourly_amount, base_daily_amount')
      .eq('id', input.user_id)
      .maybeSingle()

    const ct = userRow?.compensation_type
    if (ct === 'MONTHLY') {
      const amt = Number(userRow?.base_monthly_amount ?? 0)
      lines.push({
        rule_type: 'MONTHLY',
        description: '月額固定報酬',
        quantity: 1,
        unit: 'ヵ月',
        unit_price: amt,
        amount: amt,
        is_taxable: true,
        sort_order: ++sort,
      })
    } else if (ct === 'HOURLY') {
      const rate = Number(userRow?.base_hourly_amount ?? 0)
      lines.push({
        rule_type: 'HOURLY',
        description: '時給報酬',
        quantity: Math.round(totalHours * 100) / 100,
        unit: '時間',
        unit_price: rate,
        amount: Math.floor(rate * totalHours),
        is_taxable: true,
        sort_order: ++sort,
      })
    } else if (ct === 'DAILY') {
      const rate = Number(userRow?.base_daily_amount ?? 0)
      lines.push({
        rule_type: 'DAILY',
        description: '日給報酬',
        quantity: uniqueDays,
        unit: '日',
        unit_price: rate,
        amount: rate * uniqueDays,
        is_taxable: true,
        sort_order: ++sort,
      })
    }
  } else {
    switch (pmc.rate_type) {
      case 'MONTHLY': {
        lines.push({
          rule_type: 'MONTHLY',
          description: `${projectRow?.name ?? 'プロジェクト'} 月額固定報酬`,
          quantity: 1,
          unit: 'ヵ月',
          unit_price: pmc.rate_amount,
          amount: pmc.rate_amount,
          is_taxable: true,
          sort_order: ++sort,
        })
        break
      }
      case 'HOURLY': {
        const qty = Math.round(totalHours * 100) / 100
        lines.push({
          rule_type: 'HOURLY',
          description: `${projectRow?.name ?? 'プロジェクト'} 時給報酬`,
          quantity: qty,
          unit: '時間',
          unit_price: pmc.rate_amount,
          amount: Math.floor(pmc.rate_amount * qty),
          is_taxable: true,
          sort_order: ++sort,
        })
        break
      }
      case 'DAILY': {
        lines.push({
          rule_type: 'DAILY',
          description: `${projectRow?.name ?? 'プロジェクト'} 日給報酬`,
          quantity: uniqueDays,
          unit: '日',
          unit_price: pmc.rate_amount,
          amount: pmc.rate_amount * uniqueDays,
          is_taxable: true,
          sort_order: ++sort,
        })
        break
      }
      case 'PER_UNIT': {
        const label = pmc.unit_label || 'num_calls'
        const unitJp: NoticeUnit =
          label === 'num_closings' || label === 'num_appointments' || label === 'num_calls'
            ? '件'
            : '個'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const qty = Number((metrics as any)[label] ?? 0)
        lines.push({
          rule_type: 'PER_UNIT',
          description: `${projectRow?.name ?? 'プロジェクト'} ${label}`,
          quantity: qty,
          unit: unitJp,
          unit_price: pmc.rate_amount,
          amount: pmc.rate_amount * qty,
          is_taxable: true,
          sort_order: ++sort,
        })
        break
      }
      case 'REVENUE_SHARE': {
        const rate = pmc.rate_amount
        const amount = Math.floor(metrics.revenue * (rate / 100))
        lines.push({
          rule_type: 'REVENUE_SHARE',
          description: `${projectRow?.name ?? 'プロジェクト'} 成果報酬`,
          quantity: 1,
          unit: '式',
          unit_price: null,
          amount,
          is_taxable: true,
          formula_text: `売上：${jpMoney(metrics.revenue)} × ${rate}%`,
          sort_order: ++sort,
        })
        break
      }
      case 'COMMISSION': {
        const rules = (pmc.bonus_rules ?? [])
          .slice()
          .sort((a, b) => a.threshold - b.threshold)
        const baseCount = metrics.num_closings || metrics.num_appointments || 0
        let remaining = baseCount
        let prev = 0
        let total = 0
        for (const r of rules) {
          const band = Math.max(0, Math.min(remaining, r.threshold - prev))
          total += band * r.rate_amount
          remaining -= band
          prev = r.threshold
          if (remaining <= 0) break
        }
        if (remaining > 0 && rules.length > 0) {
          total += remaining * rules[rules.length - 1].rate_amount
        }
        lines.push({
          rule_type: 'COMMISSION',
          description: `${projectRow?.name ?? 'プロジェクト'} 段階歩合`,
          quantity: baseCount,
          unit: '件',
          unit_price: null,
          amount: Math.floor(total),
          is_taxable: true,
          formula_text: `段階歩合 ${rules.length}段階 / 基準 ${baseCount}件`,
          sort_order: ++sort,
        })
        break
      }
    }
  }

  const transportEntries = input.transportation_entries ?? []
  let transportationAmount = 0
  for (const t of transportEntries) {
    transportationAmount += t.amount
    lines.push({
      rule_type: 'TRANSPORT',
      description: `交通費 ${t.date} ${t.route}`,
      quantity: 1,
      unit: '式',
      unit_price: t.amount,
      amount: t.amount,
      is_taxable: false,
      sort_order: ++sort,
    })
  }

  const allowanceAmount = input.allowance_amount ?? 0
  if (allowanceAmount > 0) {
    lines.push({
      rule_type: 'ALLOWANCE',
      description: '諸手当',
      quantity: 1,
      unit: '式',
      unit_price: allowanceAmount,
      amount: allowanceAmount,
      is_taxable: true,
      sort_order: ++sort,
    })
  }

  if (input.adjustment_amount && input.adjustment_amount !== 0) {
    lines.push({
      rule_type: 'ADJUSTMENT',
      description: input.adjustment_note || '調整金',
      quantity: 1,
      unit: '式',
      unit_price: input.adjustment_amount,
      amount: input.adjustment_amount,
      is_taxable: true,
      sort_order: ++sort,
    })
  }

  let taxableBase = 0
  let nonTaxable = 0
  for (const l of lines) {
    if (l.is_taxable) taxableBase += l.amount
    else nonTaxable += l.amount
  }
  const tax10 = Math.floor(Math.max(0, taxableBase) * 0.1)
  const grossAmount = taxableBase + nonTaxable
  const totalAmount = grossAmount + tax10

  const staffFullName = staffRow
    ? `${staffRow.last_name ?? ''} ${staffRow.first_name ?? ''}`.trim()
    : ''
  const periodYm = input.period_end.slice(0, 7)
  const nextMonthYm = new Date(
    new Date(input.period_end).setMonth(
      new Date(input.period_end).getMonth() + 1
    )
  )
    .toISOString()
    .slice(0, 7)

  return {
    project_id: input.project_id,
    staff_id: input.staff_id,
    period_start: input.period_start,
    period_end: input.period_end,
    lines,
    taxable_amount_10: taxableBase,
    tax_amount_10: tax10,
    non_taxable_amount: nonTaxable,
    transportation_amount: transportationAmount,
    allowance_amount: allowanceAmount,
    gross_amount: grossAmount,
    total_amount: totalAmount,
    subject:
      input.subject ??
      `${projectRow?.name ?? 'プロジェクト'} ${periodYm} 支払通知`,
    recipient_name: input.recipient_name ?? staffFullName,
    recipient_honorific: input.recipient_honorific ?? '様',
    issue_date: input.issue_date ?? new Date().toISOString().slice(0, 10),
    payment_due_date: input.payment_due_date ?? lastDayOfMonth(nextMonthYm),
    payment_method: 'GMOあおぞらネット銀行 振込',
    notes: input.notes ?? '',
  }
}
