import { z } from 'zod'

// ---- Year-Month ----

export const yearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, '年月はYYYY-MM形式で入力してください')

// ---- Calculate Request ----

export const calculateRequestSchema = z.object({
  year_month: yearMonthSchema,
})

export type CalculateRequestValues = z.infer<typeof calculateRequestSchema>

// ---- Payment Update (manual adjustment) ----

export const paymentUpdateSchema = z.object({
  notes: z.string().optional().or(z.literal('')),
  adjustments: z
    .array(
      z.object({
        rule_name: z.string().min(1, 'ルール名は必須です'),
        amount: z.coerce.number({ message: '金額を入力してください' }),
        detail: z.string().optional().or(z.literal('')),
      })
    )
    .optional(),
})

export type PaymentUpdateValues = z.infer<typeof paymentUpdateSchema>

// ---- Payment Confirm ----

export const paymentConfirmSchema = z.object({
  confirmed_by: z.string().optional(),
})

export type PaymentConfirmValues = z.infer<typeof paymentConfirmSchema>

// ---- Payment Status ----

export const PAYMENT_STATUSES = [
  'draft',
  'aggregated',
  'needs_review',
  'confirmed',
  'issued',
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_STATUS_FLOW: Record<PaymentStatus, PaymentStatus[]> = {
  draft: ['aggregated'],
  aggregated: ['needs_review', 'confirmed'],
  needs_review: ['aggregated', 'confirmed'],
  confirmed: ['needs_review', 'issued'],
  issued: [],
}

/**
 * 状態遷移が可能かどうかを判定する。
 */
export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_STATUS_FLOW[from]?.includes(to) ?? false
}

// ---- Batch Actions ----

export const batchConfirmSchema = z.object({
  payment_ids: z.array(z.string().min(1)).min(1, '対象を選択してください'),
})

export type BatchConfirmValues = z.infer<typeof batchConfirmSchema>
