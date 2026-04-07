import { z } from 'zod'

// ---- shared ----
export const billingRuleTypeSchema = z.enum([
  'HOURLY',
  'MONTHLY_FIXED',
  'DAILY',
  'PER_CALL',
  'PER_APPOINTMENT',
  'PER_CLOSING',
  'REVENUE_SHARE',
  'MANAGEMENT_FEE',
  'DISCOUNT_FIXED',
  'DISCOUNT_RATE',
])
export type BillingRuleType = z.infer<typeof billingRuleTypeSchema>

export const invoiceStatusSchema = z.enum([
  'draft',
  'calculated',
  'confirmed',
  'sent',
  'paid',
  'cancelled',
])
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>

export const noticeStatusSchema = invoiceStatusSchema
export type NoticeStatus = InvoiceStatus

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日付はYYYY-MM-DD形式で入力してください')

const nonNegativeAmount = z.coerce
  .number({ message: '金額を入力してください' })
  .nonnegative('金額は0以上で入力してください')

const amountNumber = z.coerce.number({ message: '金額を入力してください' })

// ---- project_billing_rules ----
export const projectBillingRuleSchema = z
  .object({
    project_id: z.string().uuid(),
    rule_type: billingRuleTypeSchema,
    label: z.string().min(1, 'ラベルは必須です').max(100),
    unit_price: amountNumber.optional().nullable(),
    rate_percent: z.coerce
      .number()
      .min(0)
      .max(100)
      .optional()
      .nullable(),
    fixed_amount: amountNumber.optional().nullable(),
    min_amount: amountNumber.optional().nullable(),
    max_amount: amountNumber.optional().nullable(),
    tax_rate: z.coerce.number().min(0).max(1).default(0.1),
    closing_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
    payment_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
    sort_order: z.coerce.number().int().default(0),
    effective_from: isoDate,
    effective_to: isoDate.optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .refine(
    (v) =>
      !v.effective_to ||
      new Date(v.effective_to) >= new Date(v.effective_from),
    { message: '終了日は開始日以降にしてください', path: ['effective_to'] }
  )

export type ProjectBillingRuleValues = z.infer<typeof projectBillingRuleSchema>

// ---- invoice_items ----
export const invoiceItemSchema = z.object({
  id: z.string().uuid().optional(),
  billing_rule_id: z.string().uuid().optional().nullable(),
  rule_type: billingRuleTypeSchema.optional().nullable(),
  description: z.string().min(1, '内容は必須です').max(200),
  quantity: z.coerce.number().default(1),
  unit: z.string().max(20).optional().nullable(),
  unit_price: amountNumber.optional().nullable(),
  amount: amountNumber,
  tax_rate: z.coerce.number().min(0).max(1).default(0.1),
  is_taxable: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
})
export type InvoiceItemValues = z.infer<typeof invoiceItemSchema>

// ---- invoices ----
export const invoiceSchema = z
  .object({
    invoice_number: z.string().min(1).max(50).optional(),
    project_id: z.string().uuid(),
    client_id: z.string().uuid(),
    period_start: isoDate,
    period_end: isoDate,
    issue_date: isoDate,
    due_date: isoDate,
    subtotal: nonNegativeAmount.default(0),
    discount_amount: nonNegativeAmount.default(0),
    tax_amount: nonNegativeAmount.default(0),
    total_amount: nonNegativeAmount.default(0),
    currency: z.string().length(3).default('JPY'),
    status: invoiceStatusSchema.default('draft'),
    sent_to_email: z.string().email().optional().nullable(),
    bank_name: z.string().max(100).optional().nullable(),
    bank_branch: z.string().max(100).optional().nullable(),
    bank_account_type: z.string().max(20).optional().nullable(),
    bank_account_number: z.string().max(50).optional().nullable(),
    bank_account_holder: z.string().max(100).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    items: z.array(invoiceItemSchema).default([]),
  })
  .refine((v) => new Date(v.period_end) >= new Date(v.period_start), {
    message: '期間終了日は開始日以降にしてください',
    path: ['period_end'],
  })
  .refine((v) => new Date(v.due_date) >= new Date(v.issue_date), {
    message: '支払期日は発行日以降にしてください',
    path: ['due_date'],
  })

export type InvoiceValues = z.infer<typeof invoiceSchema>

// ---- invoice generate request ----
export const invoiceGenerateRequestSchema = z.object({
  period_start: isoDate,
  period_end: isoDate,
  project_ids: z.array(z.string().uuid()).min(1, 'PJを1件以上選択してください'),
})
export type InvoiceGenerateRequestValues = z.infer<
  typeof invoiceGenerateRequestSchema
>

// ---- invoice_payments (入金消込) ----
export const invoicePaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  paid_at: isoDate,
  amount: z.coerce.number().positive('金額は正の数で入力してください'),
  method: z.string().max(50).optional().nullable(),
  reference: z.string().max(200).optional().nullable(),
  bank_transfer_ref: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})
export type InvoicePaymentValues = z.infer<typeof invoicePaymentSchema>

// ---- payment_calculations (支払通知書) 拡張項目 ----
export const paymentNoticeUpdateSchema = z.object({
  transportation_amount: nonNegativeAmount.default(0),
  allowance_amount: nonNegativeAmount.default(0),
  withholding_tax_amount: nonNegativeAmount.default(0),
  sent_to_email: z.string().email().optional().nullable(),
  bank_transfer_ref: z.string().max(200).optional().nullable(),
  notice_status: noticeStatusSchema.optional(),
})
export type PaymentNoticeUpdateValues = z.infer<
  typeof paymentNoticeUpdateSchema
>

export const paymentNoticeGenerateRequestSchema = z.object({
  period_start: isoDate,
  period_end: isoDate,
  staff_ids: z
    .array(z.string().uuid())
    .min(1, 'スタッフを1件以上選択してください'),
})
export type PaymentNoticeGenerateRequestValues = z.infer<
  typeof paymentNoticeGenerateRequestSchema
>

export const paymentNoticeMarkPaidSchema = z.object({
  paid_at: isoDate,
  bank_transfer_ref: z.string().max(200).optional().nullable(),
})
export type PaymentNoticeMarkPaidValues = z.infer<
  typeof paymentNoticeMarkPaidSchema
>
