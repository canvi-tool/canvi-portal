import { z } from 'zod'

// ========== ロール管理 ==========

export const assignRoleSchema = z.object({
  user_id: z.string().min(1, 'ユーザーIDは必須です'),
  role_id: z.string().min(1, 'ロールIDは必須です'),
})

export const removeRoleSchema = z.object({
  user_id: z.string().min(1, 'ユーザーIDは必須です'),
  role_id: z.string().min(1, 'ロールIDは必須です'),
})

export const updateRolePermissionsSchema = z.object({
  role_id: z.string().min(1, 'ロールIDは必須です'),
  permission_ids: z.array(z.string()),
})

export type AssignRoleInput = z.infer<typeof assignRoleSchema>
export type RemoveRoleInput = z.infer<typeof removeRoleSchema>
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>

// ========== カスタムフィールド ==========

export const ENTITY_TYPES = [
  'staff',
  'contract',
  'project',
  'work_report',
  'performance_report',
] as const

export const FIELD_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'checkbox',
  'textarea',
] as const

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  staff: 'スタッフ',
  contract: '契約',
  project: 'プロジェクト',
  work_report: '勤務報告',
  performance_report: '業務実績',
}

export const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'テキスト',
  number: '数値',
  date: '日付',
  select: 'セレクト',
  checkbox: 'チェックボックス',
  textarea: 'テキストエリア',
}

export const createCustomFieldSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES, {
    message: 'エンティティタイプは必須です',
  }),
  field_name: z
    .string()
    .min(1, 'フィールドキーは必須です')
    .max(64, 'フィールドキーは64文字以内で入力してください')
    .regex(/^[a-z][a-z0-9_]*$/, '英小文字・数字・アンダースコアのみ使用可能です（先頭は英小文字）'),
  field_label: z
    .string()
    .min(1, 'ラベルは必須です')
    .max(128, 'ラベルは128文字以内で入力してください'),
  field_type: z.enum(FIELD_TYPES, {
    message: 'フィールドタイプは必須です',
  }),
  options: z.array(z.string()).nullable().optional(),
  is_required: z.boolean().default(false),
  sort_order: z.number().int().min(0).default(0),
})

export const updateCustomFieldSchema = z.object({
  id: z.string().min(1),
  field_label: z
    .string()
    .min(1, 'ラベルは必須です')
    .max(128, 'ラベルは128文字以内で入力してください')
    .optional(),
  field_type: z.enum(FIELD_TYPES).optional(),
  options: z.array(z.string()).nullable().optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

export const reorderCustomFieldsSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES),
  field_ids: z.array(z.string().min(1)),
})

export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>
export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldSchema>

// ========== 外部連携 ==========

export const INTEGRATION_KEYS = [
  'freee_sign',
  'google_calendar',
  'resend_email',
  'claude_ai',
] as const

export const updateIntegrationSchema = z.object({
  key: z.enum(INTEGRATION_KEYS, {
    message: '連携キーが不正です',
  }),
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>
