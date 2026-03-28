import { z } from 'zod'

export const shiftFormSchema = z.object({
  staff_id: z.string().min(1, 'スタッフは必須です'),
  project_id: z.string().min(1, 'プロジェクトは必須です'),
  shift_date: z.string().min(1, '日付は必須です'),
  start_time: z.string().min(1, '開始時刻は必須です'),
  end_time: z.string().min(1, '終了時刻は必須です'),
  notes: z.string().optional(),
}).refine((data) => data.start_time < data.end_time, {
  message: '終了時刻は開始時刻より後にしてください',
  path: ['end_time'],
})

export type ShiftFormValues = z.input<typeof shiftFormSchema>

export const shiftApprovalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'NEEDS_REVISION', 'MODIFY', 'COMMENT']),
  comment: z.string().optional(),
  new_start_time: z.string().optional(),
  new_end_time: z.string().optional(),
})

export type ShiftApprovalValues = z.infer<typeof shiftApprovalSchema>

export const shiftQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  staff_id: z.string().optional(),
  project_id: z.string().optional(),
  status: z.string().optional(),
})

export type ShiftQueryParams = z.infer<typeof shiftQuerySchema>

export const calendarSyncConfigSchema = z.object({
  calendar_id: z.string().min(1, 'カレンダーIDは必須です'),
  project_id: z.string().min(1, 'プロジェクトを選択してください'),
})

export type CalendarSyncConfigValues = z.infer<typeof calendarSyncConfigSchema>
