import { z } from 'zod'

export const projectFormSchema = z.object({
  project_code: z
    .string()
    .min(1, 'PJコードは必須です')
    .max(50, 'PJコードは50文字以内で入力してください')
    .regex(/^[A-Za-z0-9_-]+$/, 'PJコードは半角英数字・ハイフン・アンダースコアのみ使用できます'),
  name: z
    .string()
    .min(1, 'PJ名は必須です')
    .max(200, 'PJ名は200文字以内で入力してください'),
  description: z
    .string()
    .max(2000, '説明は2000文字以内で入力してください')
    .optional()
    .or(z.literal('')),
  status: z.enum(['planning', 'active', 'paused', 'completed', 'archived'], {
    message: 'ステータスを選択してください',
  }),
  client_name: z
    .string()
    .max(200, 'クライアント名は200文字以内で入力してください')
    .optional()
    .or(z.literal('')),
  start_date: z
    .string()
    .optional()
    .or(z.literal('')),
  end_date: z
    .string()
    .optional()
    .or(z.literal('')),
  google_calendar_id: z
    .string()
    .max(500, 'Google Calendar IDは500文字以内で入力してください')
    .optional()
    .or(z.literal('')),
})

export type ProjectFormValues = z.infer<typeof projectFormSchema>

export const projectApiSchema = projectFormSchema.extend({
  id: z.string().uuid().optional(),
})
