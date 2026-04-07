/**
 * 請求書 サービス層
 *
 * API ルートからは必ずこのサービスを経由して invoices /
 * invoice_items / invoice_payments を操作する。
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateInvoice,
  generateInvoiceNumber,
  type CalculatedInvoice,
} from './invoice-calculator'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'cancelled'

export interface InvoiceRow {
  id: string
  invoice_number: string
  project_id: string
  client_id: string
  period_start: string
  period_end: string
  issue_date: string
  due_date: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  paid_amount: number
  status: InvoiceStatus
  pdf_url: string | null
  sent_at: string | null
  sent_to_email: string | null
  paid_at: string | null
  bank_name: string | null
  bank_branch: string | null
  bank_account_type: string | null
  bank_account_number: string | null
  bank_account_holder: string | null
  notes: string | null
  calculation_snapshot: Record<string, unknown> | null
}

export interface CreateInvoiceInput {
  project_id: string
  client_id: string
  period_start: string
  period_end: string
  issue_date?: string
  due_date?: string
  notes?: string
  sent_to_email?: string
  user_id?: string
  /** true ならルールから自動計算して invoice_items も生成 */
  auto_calculate?: boolean
}

/**
 * 翌月3日（請求書発行日）/ 翌月末（支払期限）を期間から導出
 */
function deriveDates(periodEnd: string): { issue: string; due: string } {
  const end = new Date(periodEnd)
  const issue = new Date(end.getFullYear(), end.getMonth() + 1, 3)
  const due = new Date(end.getFullYear(), end.getMonth() + 2, 0)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { issue: fmt(issue), due: fmt(due) }
}

export async function listInvoices(
  supabase: DB,
  filters: {
    status?: string
    client_id?: string
    project_id?: string
    period?: string // YYYY-MM
  } = {},
) {
  let q = supabase
    .from('invoices')
    .select(
      '*, project:project_id(id, name), client:client_id(id, name, email)',
    )
    .is('deleted_at', null)
    .order('issue_date', { ascending: false })

  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status)
  if (filters.client_id) q = q.eq('client_id', filters.client_id)
  if (filters.project_id) q = q.eq('project_id', filters.project_id)
  if (filters.period) {
    const start = `${filters.period}-01`
    const d = new Date(start)
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      .toISOString()
      .slice(0, 10)
    q = q.gte('period_start', start).lt('period_start', next)
  }

  const { data, error } = await q
  if (error) throw new Error(`請求書一覧取得に失敗: ${error.message}`)
  return data ?? []
}

export async function getInvoice(supabase: DB, id: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select(
      '*, project:project_id(id, name), client:client_id(id, name, email, address), items:invoice_items(*), payments:invoice_payments(*)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error) throw new Error(`請求書取得に失敗: ${error.message}`)
  return data
}

export async function createInvoice(supabase: DB, input: CreateInvoiceInput) {
  const dates = deriveDates(input.period_end)
  const issueDate = input.issue_date ?? dates.issue
  const dueDate = input.due_date ?? dates.due

  let calc: CalculatedInvoice | null = null
  if (input.auto_calculate) {
    calc = await calculateInvoice(supabase, {
      projectId: input.project_id,
      periodStart: input.period_start,
      periodEnd: input.period_end,
    })
  }

  const invoiceNumber = await generateInvoiceNumber(supabase, issueDate)

  const insertPayload = {
    invoice_number: invoiceNumber,
    project_id: input.project_id,
    client_id: input.client_id,
    period_start: input.period_start,
    period_end: input.period_end,
    issue_date: issueDate,
    due_date: dueDate,
    subtotal: calc?.subtotal ?? 0,
    discount_amount: calc?.discount_amount ?? 0,
    tax_amount: calc?.tax_amount ?? 0,
    total_amount: calc?.total_amount ?? 0,
    status: 'draft' as InvoiceStatus,
    notes: input.notes ?? null,
    sent_to_email: input.sent_to_email ?? null,
    calculation_snapshot: calc?.snapshot ?? {},
    created_by: input.user_id ?? null,
    updated_by: input.user_id ?? null,
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert(insertPayload)
    .select()
    .single()
  if (error) throw new Error(`請求書作成に失敗: ${error.message}`)

  if (calc && calc.items.length > 0) {
    const itemRows = calc.items.map((it) => ({
      invoice_id: (invoice as { id: string }).id,
      billing_rule_id: it.billing_rule_id,
      rule_type: it.rule_type,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      amount: it.amount,
      is_taxable: it.is_taxable,
      sort_order: it.sort_order,
    }))
    const { error: itemErr } = await supabase.from('invoice_items').insert(itemRows)
    if (itemErr) {
      throw new Error(`請求明細作成に失敗: ${itemErr.message}`)
    }
  }

  return invoice as InvoiceRow
}

export async function updateInvoice(
  supabase: DB,
  id: string,
  patch: Partial<{
    issue_date: string
    due_date: string
    notes: string
    sent_to_email: string
    status: InvoiceStatus
    bank_name: string
    bank_branch: string
    bank_account_type: string
    bank_account_number: string
    bank_account_holder: string
    user_id: string
  }>,
) {
  const { user_id, ...rest } = patch
  const { data, error } = await supabase
    .from('invoices')
    .update({ ...rest, updated_by: user_id ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`請求書更新に失敗: ${error.message}`)
  return data as InvoiceRow
}

export async function softDeleteInvoice(supabase: DB, id: string) {
  const { error } = await supabase
    .from('invoices')
    .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
    .eq('id', id)
  if (error) throw new Error(`請求書削除に失敗: ${error.message}`)
}

export async function recordPayment(
  supabase: DB,
  invoiceId: string,
  payment: {
    paid_at: string
    amount: number
    method?: string
    bank_transfer_ref?: string
    notes?: string
    user_id?: string
  },
) {
  const { error: insErr } = await supabase.from('invoice_payments').insert({
    invoice_id: invoiceId,
    paid_at: payment.paid_at,
    amount: payment.amount,
    method: payment.method ?? 'bank_transfer',
    bank_transfer_ref: payment.bank_transfer_ref ?? null,
    notes: payment.notes ?? null,
    created_by: payment.user_id ?? null,
  })
  if (insErr) throw new Error(`入金登録に失敗: ${insErr.message}`)

  // 入金合計を再集計
  const { data: pays, error: payErr } = await supabase
    .from('invoice_payments')
    .select('amount')
    .eq('invoice_id', invoiceId)
  if (payErr) throw new Error(`入金集計に失敗: ${payErr.message}`)

  const totalPaid = (pays ?? []).reduce(
    (s, p: { amount: number }) => s + Number(p.amount),
    0,
  )

  const { data: inv, error: getErr } = await supabase
    .from('invoices')
    .select('total_amount')
    .eq('id', invoiceId)
    .single()
  if (getErr) throw new Error(`請求書取得に失敗: ${getErr.message}`)

  const newStatus: InvoiceStatus =
    totalPaid >= Number((inv as { total_amount: number }).total_amount) ? 'paid' : 'sent'

  const { error: updErr } = await supabase
    .from('invoices')
    .update({
      paid_amount: totalPaid,
      status: newStatus,
      paid_at: newStatus === 'paid' ? payment.paid_at : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
  if (updErr) throw new Error(`請求書ステータス更新に失敗: ${updErr.message}`)

  return { totalPaid, status: newStatus }
}
