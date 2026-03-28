import { z } from 'zod'

// --- Template Variable Schema ---
export const templateVariableSchema = z.object({
  key: z.string().min(1, '変数キーは必須です'),
  label: z.string().min(1, 'ラベルは必須です'),
  type: z.enum(['text', 'number', 'date', 'select', 'checkbox', 'textarea'], {
    error: '変数の型を選択してください',
  }),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  default_value: z.string().optional(),
})

export type TemplateVariable = z.infer<typeof templateVariableSchema>

// --- Contract Template Schemas ---
export const contractTemplateFormSchema = z.object({
  name: z.string().min(1, 'テンプレート名は必須です'),
  description: z.string().optional().default(''),
  content_template: z.string().min(1, 'テンプレート本文は必須です'),
  variables: z.array(templateVariableSchema).default([]),
  is_active: z.boolean().default(true),
})

export type ContractTemplateFormValues = z.input<typeof contractTemplateFormSchema>

export const contractTemplateSearchSchema = z.object({
  search: z.string().optional().default(''),
  is_active: z.string().optional().default(''),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
})

export type ContractTemplateSearchParams = z.infer<typeof contractTemplateSearchSchema>

// --- Contract Schemas ---
export const contractFormSchema = z.object({
  staff_id: z.string().min(1, 'スタッフを選択してください'),
  template_id: z.string().optional().nullable(),
  title: z.string().min(1, 'タイトルは必須です'),
  content: z.string().default(''),
  status: z.enum(['draft', 'pending_signature', 'signed', 'active', 'expired', 'terminated']).default('draft'),
  start_date: z.string().min(1, '開始日は必須です'),
  end_date: z.string().optional().nullable(),
  variables: z.record(z.string(), z.unknown()).default({}),
})

export type ContractFormValues = z.input<typeof contractFormSchema>

export const contractSearchSchema = z.object({
  search: z.string().optional().default(''),
  status: z.string().optional().default(''),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
})

export type ContractSearchParams = z.infer<typeof contractSearchSchema>

export const contractStatusUpdateSchema = z.object({
  status: z.enum(['draft', 'pending_signature', 'signed', 'active', 'expired', 'terminated']),
})

export type ContractStatusUpdate = z.infer<typeof contractStatusUpdateSchema>
