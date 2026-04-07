/**
 * 支払通知書 サービス層
 *
 * - 計算結果の永続化 (payment_calculations + payment_calculation_lines)
 * - 一覧取得 / 詳細取得 / 更新 / 削除
 * - PDFデータ整形
 * - ステータス遷移
 *
 * Phase 1 migration の拡張カラム前提:
 *   payment_calculations: project_id, notice_status, notice_pdf_url,
 *     transportation_amount, allowance_amount, taxable_amount_10,
 *     tax_amount_10, non_taxable_amount, subject, recipient_name,
 *     recipient_honorific, payment_due_date, payment_method, sent_at,
 *     sent_to_email, paid_at
 */

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  calculatePaymentNotice,
  type PaymentNoticeCalculation,
  type PaymentNoticeInput,
} from './payment-notice-calculator'
import type { BillingPdfData } from './pdf-generator'

// ---------- zod ----------

export const transportEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  route: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
})

export const generatePaymentNoticeSchema = z.object({
  staff_id: z.string().uuid(),
  user_id: z.string().uuid(),
  project_id: z.string().uuid(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transportation_entries: z.array(transportEntrySchema).optional(),
  allowance_amount: z.coerce.number().optional(),
  adjustment_amount: z.coerce.number().optional(),
  adjustment_note: z.string().optional(),
  subject: z.string().optional(),
  recipient_name: z.string().optional(),
  recipient_honorific: z.enum(['様', '御中']).optional(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  payment_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
})

export type GeneratePaymentNoticeInput = z.infer<
  typeof generatePaymentNoticeSchema
>

export const updatePaymentNoticeSchema = z.object({
  subject: z.string().optional(),
  recipient_name: z.string().optional(),
  recipient_honorific: z.enum(['様', '御中']).optional(),
  payment_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
  notice_status: z
    .enum(['draft', 'calculated', 'confirmed', 'sent', 'paid', 'cancelled'])
    .optional(),
  transportation_amount: z.coerce.number().optional(),
  allowance_amount: z.coerce.number().optional(),
})

// ---------- 採番 (NTC-YYYYMM-001) ----------

export async function generateNoticeNumber(
  yearMonth: string
): Promise<string> {
  const admin = createAdminClient()
  const prefix = `NTC-${yearMonth.replace('-', '')}-`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('payment_calculations')
    .select('notice_number')
    .like('notice_number', `${prefix}%`)
    .order('notice_number', { ascending: false })
    .limit(1)
  let next = 1
  if (data && data[0]?.notice_number) {
    const tail = String(data[0].notice_number).split('-').pop() || '0'
    next = parseInt(tail, 10) + 1
  }
  return `${prefix}${String(next).padStart(3, '0')}`
}

// ---------- 生成 (計算 → 永続化) ----------

export async function generatePaymentNotice(
  input: GeneratePaymentNoticeInput,
  createdBy: string
): Promise<{ id: string; calculation: PaymentNoticeCalculation }> {
  const calc = await calculatePaymentNotice(input as PaymentNoticeInput)

  const admin = createAdminClient()
  const yearMonth = calc.period_end.slice(0, 7)
  const noticeNumber = await generateNoticeNumber(yearMonth)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: header, error } = await (admin as any)
    .from('payment_calculations')
    .insert({
      staff_id: calc.staff_id,
      project_id: calc.project_id,
      year_month: yearMonth,
      period_start: calc.period_start,
      period_end: calc.period_end,
      total_amount: calc.total_amount,
      taxable_amount_10: calc.taxable_amount_10,
      tax_amount_10: calc.tax_amount_10,
      non_taxable_amount: calc.non_taxable_amount,
      transportation_amount: calc.transportation_amount,
      allowance_amount: calc.allowance_amount,
      subject: calc.subject,
      recipient_name: calc.recipient_name,
      recipient_honorific: calc.recipient_honorific,
      issue_date: calc.issue_date,
      payment_due_date: calc.payment_due_date,
      payment_method: calc.payment_method,
      notes: calc.notes,
      notice_number: noticeNumber,
      notice_status: 'calculated',
      status: 'calculated',
      created_by: createdBy,
    })
    .select('id')
    .single()

  if (error || !header) {
    throw new Error(`支払通知書ヘッダ作成失敗: ${error?.message ?? 'unknown'}`)
  }

  if (calc.lines.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: lineErr } = await (admin as any)
      .from('payment_calculation_lines')
      .insert(
        calc.lines.map((l) => ({
          payment_calculation_id: header.id,
          rule_type: l.rule_type,
          rule_name: l.description,
          description: l.description,
          quantity: l.quantity,
          unit_label: l.unit,
          unit_price: l.unit_price,
          amount: l.amount,
          is_taxable: l.is_taxable,
          formula_text: l.formula_text ?? null,
          sort_order: l.sort_order,
        }))
      )
    if (lineErr) {
      throw new Error(`支払通知書明細作成失敗: ${lineErr.message}`)
    }
  }

  return { id: header.id, calculation: calc }
}

// ---------- 一覧 ----------

export async function listPaymentNotices(filter: {
  yearMonth?: string
  status?: string
  projectId?: string
}) {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = (admin as any)
    .from('payment_calculations')
    .select(
      `id, notice_number, project_id, staff_id, year_month, period_start, period_end,
       subject, recipient_name, recipient_honorific, total_amount,
       taxable_amount_10, tax_amount_10, non_taxable_amount,
       notice_status, sent_at, paid_at, created_at,
       staff:staff_id (id, last_name, first_name, email),
       project:project_id (id, name)`
    )
    .order('created_at', { ascending: false })
  if (filter.yearMonth) q = q.eq('year_month', filter.yearMonth)
  if (filter.status && filter.status !== 'all')
    q = q.eq('notice_status', filter.status)
  if (filter.projectId) q = q.eq('project_id', filter.projectId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

// ---------- 詳細 ----------

export async function getPaymentNotice(id: string) {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: header, error } = await (admin as any)
    .from('payment_calculations')
    .select(
      `*, staff:staff_id(*), project:project_id(*)`
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!header) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lines } = await (admin as any)
    .from('payment_calculation_lines')
    .select('*')
    .eq('payment_calculation_id', id)
    .order('sort_order', { ascending: true })
  return { ...header, lines: lines ?? [] }
}

// ---------- 更新 ----------

export async function updatePaymentNotice(
  id: string,
  patch: z.infer<typeof updatePaymentNoticeSchema>
) {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('payment_calculations')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------- 削除 (論理削除) ----------

export async function deletePaymentNotice(id: string) {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('payment_calculations')
    .update({ deleted_at: new Date().toISOString(), notice_status: 'cancelled' })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------- PDFデータ整形 ----------

export function toPdfData(notice: {
  notice_number: string | null
  subject: string | null
  recipient_name: string | null
  recipient_honorific: '様' | '御中' | null
  issue_date: string | null
  payment_due_date: string | null
  payment_method: string | null
  notes: string | null
  taxable_amount_10: number | null
  tax_amount_10: number | null
  non_taxable_amount: number | null
  total_amount: number | null
  lines: Array<{
    description: string
    quantity: number
    unit_label: string
    unit_price: number | null
    amount: number
    is_taxable: boolean
    formula_text: string | null
  }>
}): BillingPdfData {
  return {
    docType: 'notice',
    documentNumber: notice.notice_number ?? '',
    subject: notice.subject ?? '',
    recipientName: notice.recipient_name ?? '',
    recipientHonorific: notice.recipient_honorific ?? '様',
    issueDate: notice.issue_date ?? '',
    paymentDueDate: notice.payment_due_date ?? '',
    paymentMethod: notice.payment_method ?? 'GMOあおぞらネット銀行 振込',
    notes: notice.notes ?? '',
    taxable_amount_10: Number(notice.taxable_amount_10 ?? 0),
    tax_amount_10: Number(notice.tax_amount_10 ?? 0),
    non_taxable_amount: Number(notice.non_taxable_amount ?? 0),
    total_amount: Number(notice.total_amount ?? 0),
    lines: (notice.lines ?? []).map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unit: l.unit_label,
      unit_price: l.unit_price !== null ? Number(l.unit_price) : null,
      amount: Number(l.amount),
      is_taxable: l.is_taxable,
      formula_text: l.formula_text,
    })),
  }
}
