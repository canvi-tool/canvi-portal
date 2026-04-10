import { z } from 'zod'

export const projectFormSchema = z.object({
  project_type: z.enum(['BPO', 'RPO', 'ETC', 'CAN'], {
    message: 'PJ種別を選択してください',
  }),
  project_number: z
    .string()
    .min(1, '番号は必須です')
    .regex(/^\d{3}$/, '001〜999の3桁で入力してください'),
  project_code: z.string().optional(),
  name: z
    .string()
    .min(1, 'PJ名は必須です')
    .max(200, 'PJ名は200文字以内で入力してください'),
  description: z
    .string()
    .max(2000, '説明は2000文字以内で入力してください')
    .optional()
    .or(z.literal('')),
  status: z.enum(['proposing', 'active', 'ended'], {
    message: 'ステータスを選択してください',
  }),
  client_id: z
    .string()
    .optional()
    .or(z.literal('')),
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
  slack_channel_id: z
    .string()
    .max(100)
    .optional()
    .or(z.literal('')),
  slack_channel_name: z
    .string()
    .max(200)
    .optional()
    .or(z.literal('')),
  shift_approval_mode: z
    .enum(['AUTO', 'APPROVAL'])
    .optional(),
  calendar_display_name: z
    .string()
    .max(200, 'カレンダー表記名は200文字以内で入力してください')
    .optional()
    .or(z.literal('')),
})

export type ProjectFormValues = z.infer<typeof projectFormSchema>

export const projectApiSchema = projectFormSchema.extend({
  id: z.string().uuid().optional(),
})
