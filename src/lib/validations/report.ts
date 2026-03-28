import { z } from 'zod'

export const workReportFormSchema = z.object({
  staff_id: z.string().min(1, 'スタッフを選択してください'),
  project_id: z.string().optional().or(z.literal('')),
  year_month: z.string().min(1, '対象年月を入力してください'),
  total_hours: z.coerce.number().min(0, '勤務時間は0以上で入力してください').default(0),
  overtime_hours: z.coerce.number().min(0, '残業時間は0以上で入力してください').default(0),
  working_days: z.coerce.number().min(0, '勤務日数は0以上で入力してください').default(0),
  standby_hours: z.coerce.number().min(0, '待機時間は0以上で入力してください').default(0),
  standby_days: z.coerce.number().min(0, '待機日数は0以上で入力してください').default(0),
  notes: z.string().max(5000, '備考は5000文字以内で入力してください').optional().or(z.literal('')),
  qualitative_report: z.string().max(10000, '定性報告は10000文字以内で入力してください').optional().or(z.literal('')),
  deliverable_url: z.string().url('有効なURLを入力してください').optional().or(z.literal('')),
  count_data: z.record(z.string(), z.coerce.number().min(0)).optional(),
})

export type WorkReportFormValues = z.input<typeof workReportFormSchema>

export const workReportQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  staff_id: z.string().optional(),
  project_id: z.string().optional(),
  status: z.string().optional(),
})

export type WorkReportQueryParams = z.infer<typeof workReportQuerySchema>

export const workReportApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected'], { message: 'ステータスを選択してください' }),
  comment: z.string().max(2000, 'コメントは2000文字以内で入力してください').optional().or(z.literal('')),
})

export type WorkReportApprovalValues = z.infer<typeof workReportApprovalSchema>

export const performanceReportFormSchema = z.object({
  staff_id: z.string().min(1, 'スタッフを選択してください'),
  project_id: z.string().optional().or(z.literal('')),
  year_month: z.string().min(1, '対象年月を入力してください'),
  call_count: z.coerce.number().min(0, '架電件数は0以上で入力してください').default(0),
  appointment_count: z.coerce.number().min(0, 'アポ件数は0以上で入力してください').default(0),
  other_counts: z.record(z.string(), z.coerce.number().min(0)).optional(),
  notes: z.string().max(5000, '備考は5000文字以内で入力してください').optional().or(z.literal('')),
})

export type PerformanceReportFormValues = z.input<typeof performanceReportFormSchema>

export const performanceReportQuerySchema = z.object({
  year_month: z.string().optional(),
  staff_id: z.string().optional(),
  project_id: z.string().optional(),
  status: z.string().optional(),
})

export type PerformanceReportQueryParams = z.infer<typeof performanceReportQuerySchema>
