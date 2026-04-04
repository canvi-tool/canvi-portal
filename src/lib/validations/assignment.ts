import { z } from 'zod'

export const assignmentFormSchema = z.object({
  staff_id: z.string().min(1, 'スタッフを選択してください'),
  role_title: z
    .string()
    .max(200, '役割は200文字以内で入力してください')
    .optional()
    .or(z.literal('')),
  status: z.enum(['proposed', 'confirmed', 'in_progress', 'completed', 'cancelled'], {
    message: 'ステータスを選択してください',
  }),
  start_date: z.string().min(1, '開始日は必須です'),
  end_date: z
    .string()
    .optional()
    .or(z.literal('')),
})

export type AssignmentFormValues = z.infer<typeof assignmentFormSchema>

// ----- Compensation Rule Schemas -----

const timeRateParamsSchema = z.object({
  rate_per_hour: z.coerce.number().min(0, '時間単価は0以上で入力してください'),
  overtime_multiplier: z.coerce.number().min(1, '残業倍率は1以上で入力してください').optional(),
  overtime_threshold_hours: z.coerce.number().min(0, '残業基準時間は0以上で入力してください').optional(),
})

const countRateParamsSchema = z.object({
  unit_name: z.string().min(1, '単位名は必須です'),
  rate_per_unit: z.coerce.number().min(0, '単価は0以上で入力してください'),
  minimum_count: z.coerce.number().min(0, '最低件数は0以上で入力してください').optional(),
})

const standbyRateParamsSchema = z.object({
  rate_per_hour: z.coerce.number().min(0, '時間単価は0以上で入力してください').optional(),
  rate_per_day: z.coerce.number().min(0, '日額は0以上で入力してください').optional(),
})

const monthlyFixedParamsSchema = z.object({
  amount: z.coerce.number().min(0, '月額は0以上で入力してください'),
})

const fixedPlusVariableParamsSchema = z.object({
  fixed_amount: z.coerce.number().min(0, '固定額は0以上で入力してください'),
  variable_unit: z.string().min(1, '変動単位名は必須です'),
  variable_rate: z.coerce.number().min(0, '変動単価は0以上で入力してください'),
})

const percentageParamsSchema = z.object({
  base_rule_id: z.string().min(1, '基準ルールを選択してください'),
  percentage: z.coerce.number().min(0, '率は0以上で入力してください').max(1000, '率は1000以下で入力してください'),
  description: z.string().optional().or(z.literal('')),
})

const adjustmentParamsSchema = z.object({
  amount: z.coerce.number({ message: '金額を入力してください' }),
  reason: z.string().min(1, '理由は必須です'),
})

export const compensationRuleTypes = [
  'time_rate',
  'count_rate',
  'standby_rate',
  'monthly_fixed',
  'fixed_plus_variable',
  'percentage',
  'adjustment',
] as const

export type CompensationRuleTypeValue = (typeof compensationRuleTypes)[number]

export const compensationRuleFormSchema = z.object({
  rule_type: z.enum(compensationRuleTypes, {
    message: 'ルールタイプを選択してください',
  }),
  name: z.string().min(1, 'ルール名は必須です').max(200, 'ルール名は200文字以内で入力してください'),
  description: z.string().optional().or(z.literal('')),
  priority: z.coerce.number().int().min(0, '優先度は0以上で入力してください').default(0),
  is_active: z.boolean().default(true),
  effective_from: z.string().optional().or(z.literal('')),
  effective_until: z.string().optional().or(z.literal('')),
  params: z.record(z.string(), z.unknown()),
})

export type CompensationRuleFormValues = z.input<typeof compensationRuleFormSchema>

export const paramsSchemaMap: Record<CompensationRuleTypeValue, z.ZodType> = {
  time_rate: timeRateParamsSchema,
  count_rate: countRateParamsSchema,
  standby_rate: standbyRateParamsSchema,
  monthly_fixed: monthlyFixedParamsSchema,
  fixed_plus_variable: fixedPlusVariableParamsSchema,
  percentage: percentageParamsSchema,
  adjustment: adjustmentParamsSchema,
}

export function validateParams(ruleType: CompensationRuleTypeValue, params: unknown) {
  const schema = paramsSchemaMap[ruleType]
  return schema.safeParse(params)
}

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  proposed: '提案中',
  confirmed: '確定',
  in_progress: '稼働中',
  completed: '完了',
  cancelled: 'キャンセル',
}
