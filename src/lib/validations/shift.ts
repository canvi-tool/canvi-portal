import { z } from 'zod'

export const SHIFT_TYPES = ['WORK', 'PAID_LEAVE', 'HALF_DAY_LEAVE', 'SPECIAL_LEAVE', 'ABSENCE'] as const
export type ShiftType = typeof SHIFT_TYPES[number]

export const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  WORK: '通常勤務',
  PAID_LEAVE: '有給休暇',
  HALF_DAY_LEAVE: '半休',
  SPECIAL_LEAVE: '特別休暇',
  ABSENCE: '欠勤',
}

export const attendeeSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  name: z.string().optional(),
  staff_id: z.string().optional(),
})
export type Attendee = z.infer<typeof attendeeSchema>

export const shiftFormSchema = z.object({
  staff_id: z.string().min(1, 'スタッフは必須です'),
  project_id: z.string().min(1, 'プロジェクトは必須です'),
  shift_date: z.string().min(1, '日付は必須です'),
  start_time: z.string().min(1, '開始時刻は必須です'),
  end_time: z.string().min(1, '終了時刻は必須です'),
  shift_type: z.enum(SHIFT_TYPES).default('WORK'),
  notes: z.string().optional(),
  attendees: z.array(attendeeSchema).optional().default([]),
}).refine((data) => data.start_time < data.end_time, {
  message: '終了時刻は開始時刻より後にしてください',
  path: ['end_time'],
})

export type ShiftFormValues = z.input<typeof shiftFormSchema>

export const shiftDragUpdateSchema = z.object({
  shift_date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
}).refine((data) => data.start_time < data.end_time, {
  message: '終了時刻は開始時刻より後にしてください',
  path: ['end_time'],
})

export type ShiftDragUpdateValues = z.infer<typeof shiftDragUpdateSchema>

export const shiftInlineUpdateSchema = z.object({
  start_time: z.string().min(1, '開始時刻は必須です'),
  end_time: z.string().min(1, '終了時刻は必須です'),
  project_id: z.string().optional(),
  notes: z.string().optional(),
  attendees: z.array(attendeeSchema).optional(),
  _inlineUpdate: z.literal(true),
}).refine((data) => data.start_time < data.end_time, {
  message: '終了時刻は開始時刻より後にしてください',
  path: ['end_time'],
})

export type ShiftInlineUpdateValues = z.infer<typeof shiftInlineUpdateSchema>

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
