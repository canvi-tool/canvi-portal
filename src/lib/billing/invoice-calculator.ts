/**
 * 請求書 計算エンジン
 *
 * project_billing_rules + シフト実績 + work_reports.custom_fields から
 * 請求明細を生成し、小計 / 消費税 / 合計を返す。
 *
 * 計算ロジック詳細は docs/REQUIREMENTS_BILLING.md §4.2 を参照。
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type BillingRuleType =
  | 'HOURLY'
  | 'MONTHLY_FIXED'
  | 'DAILY'
  | 'PER_CALL'
  | 'PER_APPOINTMENT'
  | 'PER_CLOSING'
  | 'REVENUE_SHARE'
  | 'MANAGEMENT_FEE'
  | 'DISCOUNT_FIXED'
  | 'DISCOUNT_RATE'

export interface BillingRule {
  id: string
  project_id: string
  rule_type: BillingRuleType
  label: string
  unit_price: number | null
  rate_percent: number | null
  fixed_amount: number | null
  min_amount: number | null
  max_amount: number | null
  sort_order: number
  effective_from: string
  effective_to: string | null
}

export interface CalculatedInvoiceItem {
  billing_rule_id: string | null
  rule_type: BillingRuleType
  description: string
  quantity: number
  unit_price: number | null
  amount: number
  is_taxable: boolean
  sort_order: number
}

export interface CalculatedInvoice {
  items: CalculatedInvoiceItem[]
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  taxable_base: number
  snapshot: Record<string, unknown>
}

export interface CalculateInvoiceParams {
  projectId: string
  periodStart: string // YYYY-MM-DD
  periodEnd: string
  taxRate?: number // default 0.10
}

const DEFAULT_TAX_RATE = 0.1

/**
 * シフト実績から PJ の総稼働時間を集計する
 */
async function sumProjectHours(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  periodStart: string,
  periodEnd: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('shifts')
      .select('start_time, end_time, break_minutes')
      .eq('project_id', projectId)
      .gte('shift_date', periodStart)
      .lte('shift_date', periodEnd)
      .neq('status', 'cancelled')

    if (error || !data) return 0
    let totalMinutes = 0
    for (const s of data as Array<{
      start_time: string | null
      end_time: string | null
      break_minutes: number | null
    }>) {
      if (!s.start_time || !s.end_time) continue
      const start = new Date(`1970-01-01T${s.start_time}`).getTime()
      const end = new Date(`1970-01-01T${s.end_time}`).getTime()
      if (isNaN(start) || isNaN(end) || end <= start) continue
      totalMinutes += (end - start) / 60000 - (s.break_minutes ?? 0)
    }
    return Math.max(0, totalMinutes / 60)
  } catch {
    return 0
  }
}

async function countProjectWorkDays(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  periodStart: string,
  periodEnd: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('shifts')
      .select('shift_date')
      .eq('project_id', projectId)
      .gte('shift_date', periodStart)
      .lte('shift_date', periodEnd)
      .neq('status', 'cancelled')
    if (error || !data) return 0
    const set = new Set<string>()
    for (const s of data as Array<{ shift_date: string }>) {
      if (s.shift_date) set.add(s.shift_date)
    }
    return set.size
  } catch {
    return 0
  }
}

async function sumWorkReportField(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectId: string,
  field: string,
  periodStart: string,
  periodEnd: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('work_reports')
      .select('custom_fields')
      .eq('project_id', projectId)
      .gte('report_date', periodStart)
      .lte('report_date', periodEnd)
    if (error || !data) return 0
    let total = 0
    for (const r of data as Array<{ custom_fields: Record<string, unknown> | null }>) {
      const v = r.custom_fields?.[field]
      const num = typeof v === 'number' ? v : Number(v)
      if (!isNaN(num)) total += num
    }
    return total
  } catch {
    return 0
  }
}

/**
 * 指定 PJ ・期間の請求書を計算する
 */
export async function calculateInvoice(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  params: CalculateInvoiceParams,
): Promise<CalculatedInvoice> {
  const { projectId, periodStart, periodEnd, taxRate = DEFAULT_TAX_RATE } = params

  const { data: rulesData, error: rulesErr } = await supabase
    .from('project_billing_rules')
    .select('*')
    .eq('project_id', projectId)
    .lte('effective_from', periodEnd)
    .or(`effective_to.is.null,effective_to.gte.${periodStart}`)
    .order('sort_order', { ascending: true })

  if (rulesErr) {
    throw new Error(`課金ルール取得に失敗: ${rulesErr.message}`)
  }

  const rules = (rulesData ?? []) as BillingRule[]
  const items: CalculatedInvoiceItem[] = []
  const snapshot: Record<string, unknown> = {
    period_start: periodStart,
    period_end: periodEnd,
    rule_count: rules.length,
  }

  let runningSubtotal = 0
  let order = 0

  for (const rule of rules) {
    let qty = 1
    let unitPrice: number | null = rule.unit_price
    let amount = 0
    let description = rule.label

    switch (rule.rule_type) {
      case 'HOURLY': {
        qty = await sumProjectHours(supabase, projectId, periodStart, periodEnd)
        amount = Math.floor(qty * (rule.unit_price ?? 0))
        description = `${rule.label}（時給）`
        break
      }
      case 'MONTHLY_FIXED': {
        qty = 1
        unitPrice = rule.fixed_amount
        amount = rule.fixed_amount ?? 0
        break
      }
      case 'DAILY': {
        qty = await countProjectWorkDays(supabase, projectId, periodStart, periodEnd)
        amount = Math.floor(qty * (rule.unit_price ?? 0))
        description = `${rule.label}（日給）`
        break
      }
      case 'PER_CALL': {
        qty = await sumWorkReportField(supabase, projectId, 'num_calls', periodStart, periodEnd)
        amount = Math.floor(qty * (rule.unit_price ?? 0))
        break
      }
      case 'PER_APPOINTMENT': {
        qty = await sumWorkReportField(
          supabase,
          projectId,
          'num_appointments',
          periodStart,
          periodEnd,
        )
        amount = Math.floor(qty * (rule.unit_price ?? 0))
        break
      }
      case 'PER_CLOSING': {
        qty = await sumWorkReportField(
          supabase,
          projectId,
          'num_closings',
          periodStart,
          periodEnd,
        )
        amount = Math.floor(qty * (rule.unit_price ?? 0))
        break
      }
      case 'REVENUE_SHARE': {
        const rev = await sumWorkReportField(
          supabase,
          projectId,
          'revenue',
          periodStart,
          periodEnd,
        )
        qty = rev
        amount = Math.floor((rev * (rule.rate_percent ?? 0)) / 100)
        description = `${rule.label}（売上${rule.rate_percent}%）`
        break
      }
      case 'MANAGEMENT_FEE': {
        amount = Math.floor((runningSubtotal * (rule.rate_percent ?? 0)) / 100)
        description = `${rule.label}（管理費${rule.rate_percent}%）`
        break
      }
      case 'DISCOUNT_FIXED': {
        amount = -(rule.fixed_amount ?? 0)
        description = `${rule.label}（値引）`
        break
      }
      case 'DISCOUNT_RATE': {
        amount = -Math.floor((runningSubtotal * (rule.rate_percent ?? 0)) / 100)
        description = `${rule.label}（${rule.rate_percent}%値引）`
        break
      }
    }

    // min/max clamp（割引以外）
    if (amount > 0) {
      if (rule.min_amount != null && amount < rule.min_amount) amount = rule.min_amount
      if (rule.max_amount != null && amount > rule.max_amount) amount = rule.max_amount
    }

    items.push({
      billing_rule_id: rule.id,
      rule_type: rule.rule_type,
      description,
      quantity: Number(qty.toFixed(2)),
      unit_price: unitPrice,
      amount,
      is_taxable: true,
      sort_order: order++,
    })

    if (amount > 0) runningSubtotal += amount
  }

  const subtotal = items.filter((i) => i.amount > 0).reduce((s, i) => s + i.amount, 0)
  const discountAmount = items
    .filter((i) => i.amount < 0)
    .reduce((s, i) => s + Math.abs(i.amount), 0)
  const taxableBase = Math.max(0, subtotal - discountAmount)
  const taxAmount = Math.floor(taxableBase * taxRate)
  const totalAmount = taxableBase + taxAmount

  return {
    items,
    subtotal,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    taxable_base: taxableBase,
    snapshot,
  }
}

/**
 * 請求番号採番（INV-YYYYMM-NNN, 月単位リセット, 3桁）
 */
export async function generateInvoiceNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  issueDate: string,
): Promise<string> {
  const ym = issueDate.slice(0, 7).replace('-', '')
  const prefix = `INV-${ym}-`
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
  if (error) throw new Error(`採番に失敗: ${error.message}`)
  let next = 1
  if (data && data.length > 0) {
    const last = (data[0] as { invoice_number: string }).invoice_number
    const tail = last.slice(prefix.length)
    const n = parseInt(tail, 10)
    if (!isNaN(n)) next = n + 1
  }
  return `${prefix}${String(next).padStart(3, '0')}`
}
