import { z } from 'zod'

export const shiftFormSchema = z.object({
  staff_id: z.string().min(1, 'スタッフを選択してください'),
  project_id: z.string().optional().or(z.literal('')),
  date: z.string().min(1, '日付を入力してください'),
  start_time: z.string().optional().or(z.literal('')),
  end_time: z.string().optional().or(z.literal('')),
  break_minutes: z.coerce.number().min(0, '休憩時間は0以上で入力してください').default(0),
  shift_type: z.string().optional().or(z.literal('')),
  notes: z.string().max(2000, 'メモは2000文字以内で入力してください').optional().or(z.literal('')),
})

export type ShiftFormValues = z.input<typeof shiftFormSchema>

export const shiftApiSchema = shiftFormSchema.extend({
  id: z.string().uuid().optional(),
})

export const shiftQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  staff_id: z.string().optional(),
  project_id: z.string().optional(),
})

export type ShiftQueryParams = z.infer<typeof shiftQuerySchema>

export const calendarSyncConfigSchema = z.object({
  calendar_id: z.string().min(1, 'カレンダーIDは必須です'),
  project_id: z.string().min(1, 'プロジェクトを選択してください'),
})

export type CalendarSyncConfigValues = z.infer<typeof calendarSyncConfigSchema>
