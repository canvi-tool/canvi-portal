import { z } from 'zod'

// ---- 承認スキーマ（後方互換 re-export） ----
// 新しいimport先: '@/lib/validations/daily-report'
export { workReportApprovalSchema, type WorkReportApprovalValues } from '@/lib/validations/daily-report'

// ---- 旧 Work Report スキーマ（performance API 互換用に維持） ----
export const workReportFormSchema = z.object({
  staff_id: z.string().min(1, 'スタッフを選択してください'),
  project_id: z.string().optional().or(z.literal('')),
  year_month: z.string().min(1, '対象年月を入力してください'),
  total_hours: z.coerce.number().min(0).default(0),
  overtime_hours: z.coerce.number().min(0).default(0),
  working_days: z.coerce.number().min(0).default(0),
  standby_hours: z.coerce.number().min(0).default(0),
  standby_days: z.coerce.number().min(0).default(0),
  notes: z.string().max(5000).optional().or(z.literal('')),
  qualitative_report: z.string().max(10000).optional().or(z.literal('')),
  deliverable_url: z.string().url().optional().or(z.literal('')),
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

// ---- Performance Report スキーマ ----
export const performanceReportFormSchema = z.object({
  staff_id: z.string().min(1, 'スタッフを選択してください'),
  project_id: z.string().optional().or(z.literal('')),
  year_month: z.string().min(1, '対象年月を入力してください'),
  call_count: z.coerce.number().min(0).default(0),
  appointment_count: z.coerce.number().min(0).default(0),
  other_counts: z.record(z.string(), z.coerce.number().min(0)).optional(),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type PerformanceReportFormValues = z.input<typeof performanceReportFormSchema>

export const performanceReportQuerySchema = z.object({
  year_month: z.string().optional(),
  staff_id: z.string().optional(),
  project_id: z.string().optional(),
  status: z.string().optional(),
})

export type PerformanceReportQueryParams = z.infer<typeof performanceReportQuerySchema>
