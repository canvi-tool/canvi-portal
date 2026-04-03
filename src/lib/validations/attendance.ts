import { z } from 'zod'

// 打刻（出勤）
export const clockInSchema = z.object({
  project_id: z.string().uuid('プロジェクトIDが不正です').optional().or(z.literal('')),
  location_type: z.enum(['office', 'remote', 'client_site', 'other']).optional(),
  note: z.string().max(500).optional().or(z.literal('')),
})

export type ClockInInput = z.infer<typeof clockInSchema>

// 打刻（退勤）
export const clockOutSchema = z.object({
  note: z.string().max(500).optional().or(z.literal('')),
})

export type ClockOutInput = z.infer<typeof clockOutSchema>

// 打刻修正
export const attendanceModifySchema = z.object({
  clock_in: z.string().optional(),
  clock_out: z.string().optional(),
  break_minutes: z.number().min(0).max(480).optional(),
  project_id: z.string().uuid().optional().or(z.literal('')),
  location_type: z.enum(['office', 'remote', 'client_site', 'other']).optional(),
  note: z.string().max(500).optional().or(z.literal('')),
  modification_reason: z.string().min(1, '修正理由は必須です').max(500),
})

export type AttendanceModifyInput = z.infer<typeof attendanceModifySchema>

// 勤怠ステータス
export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  clocked_in: '勤務中',
  on_break: '休憩中',
  clocked_out: '退勤済',
  modified: '修正済',
  approved: '承認済',
}

export const LOCATION_TYPE_LABELS: Record<string, string> = {
  office: 'オフィス',
  remote: 'リモート',
  client_site: '客先',
  other: 'その他',
}
