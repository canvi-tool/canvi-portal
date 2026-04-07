import { z } from 'zod'

// ---- 承認スキーマ ----
export const workReportApprovalSchema = z.object({
  status: z.enum(['approved', 'rejected'], { message: 'ステータスを選択してください' }),
  comment: z.string().max(2000, 'コメントは2000文字以内で入力してください').optional().or(z.literal('')),
})

export type WorkReportApprovalValues = z.infer<typeof workReportApprovalSchema>

// ---- 日報タイプ ----
export const DAILY_REPORT_TYPES = ['training', 'outbound', 'inbound', 'leon_is'] as const
export type DailyReportType = (typeof DAILY_REPORT_TYPES)[number]

export const DAILY_REPORT_TYPE_LABELS: Record<DailyReportType, string> = {
  training: '研修日報',
  outbound: '架電日報',
  inbound: '受電日報',
  leon_is: 'レオン矯正IS',
}

// ---- 研修日報スキーマ ----
export const trainingReportSchema = z.object({
  report_type: z.literal('training'),
  report_date: z.string().min(1, '日付を入力してください'),
  project_id: z.string().optional().or(z.literal('')),

  study_theme: z.string().min(1, '自習テーマを入力してください').max(500),
  smooth_operations: z.string().min(1, 'スムーズにできた内容を入力してください').max(2000),
  difficulties: z.string().min(1, '難しかった内容を入力してください').max(2000),
  self_solved: z.string().max(2000).optional().or(z.literal('')),

  awareness: z.string().min(1, '気づきを入力してください').max(2000),
  tomorrow_focus: z.string().min(1, '次回の重点項目を入力してください').max(2000),
  questions: z.string().max(2000).optional().or(z.literal('')),

  concentration_level: z.coerce.number().min(1).max(5).optional(),
  condition_comment: z.string().max(500).optional().or(z.literal('')),
})

export type TrainingReportFormValues = z.infer<typeof trainingReportSchema>

// ---- 架電日報スキーマ ----
export const outboundReportSchema = z.object({
  report_type: z.literal('outbound'),
  report_date: z.string().min(1, '日付を入力してください'),
  project_id: z.string().min(1, 'プロジェクトを選択してください'),

  // KPI実績（当日）
  daily_call_count_target: z.coerce.number().min(0).default(0),
  daily_call_count_actual: z.coerce.number().min(0, '架電数を入力してください'),
  daily_contact_count: z.coerce.number().min(0, '通電数を入力してください'),
  daily_appointment_count: z.coerce.number().min(0, 'アポ数を入力してください'),

  // 行動の質（定性）
  self_evaluation: z.string().min(1, '自己評価を入力してください').max(3000),
  talk_improvements: z.string().min(1, 'トークの工夫を入力してください').max(2000),

  // 任意記入
  appointment_patterns: z.string().max(2000).optional().or(z.literal('')),
  rejection_patterns: z.string().max(2000).optional().or(z.literal('')),

  // 改善・次アクション
  tomorrow_call_target: z.coerce.number().min(0).default(0),
  tomorrow_appointment_target: z.coerce.number().min(0).default(0),
  tomorrow_improvement: z.string().min(1, '改善アクションを入力してください').max(2000),
  escalation_items: z.string().max(2000).optional().or(z.literal('')),

  // コンディション
  condition: z.string().max(1000).optional().or(z.literal('')),
  concentration_level: z.coerce.number().min(1).max(5).optional(),
  condition_comment: z.string().max(500).optional().or(z.literal('')),
})

export type OutboundReportFormValues = z.infer<typeof outboundReportSchema>

// ---- 受電日報スキーマ ----
export const inboundReportSchema = z.object({
  report_type: z.literal('inbound'),
  report_date: z.string().min(1, '日付を入力してください'),
  project_id: z.string().min(1, 'プロジェクトを選択してください'),

  // KPI実績（当日）
  daily_received_count: z.coerce.number().min(0, '受電数を入力してください'),
  daily_completed_count: z.coerce.number().min(0, '対応完了数を入力してください'),
  daily_escalation_count: z.coerce.number().min(0).default(0),
  daily_avg_handle_time: z.coerce.number().min(0).optional(),

  // 行動の質（定性）
  self_evaluation: z.string().min(1, '自己評価を入力してください').max(3000),
  improvements: z.string().min(1, '工夫した点を入力してください').max(2000),

  // 任意記入
  common_inquiries: z.string().max(2000).optional().or(z.literal('')),
  difficult_cases: z.string().max(2000).optional().or(z.literal('')),

  // 改善・次アクション
  tomorrow_improvement: z.string().min(1, '改善アクションを入力してください').max(2000),
  escalation_items: z.string().max(2000).optional().or(z.literal('')),

  // コンディション
  condition: z.string().max(1000).optional().or(z.literal('')),
  concentration_level: z.coerce.number().min(1).max(5).optional(),
  condition_comment: z.string().max(500).optional().or(z.literal('')),
})

export type InboundReportFormValues = z.infer<typeof inboundReportSchema>

// ---- レオン矯正IS日報スキーマ ----
export const leonIsReportSchema = z.object({
  report_type: z.literal('leon_is'),
  report_date: z.string().min(1, '日付を入力してください'),
  project_id: z.string().min(1, 'プロジェクトを選択してください'),

  // KPI実績（当日）定量
  immediate_call_count: z.coerce.number().min(0, '即時架電数を入力してください'),
  followup_call_count: z.coerce.number().min(0, '追客架電数を入力してください'),
  received_call_count: z.coerce.number().min(0, '受電数を入力してください'),
  contract_zoom_count: z.coerce.number().min(0, '契約入金および伴走（Zoom入数）を入力してください'),

  // 行動の質（定性）
  self_evaluation: z.string().min(1, '自己評価を入力してください').max(3000),
  current_issues: z.string().min(1, '現状の課題を入力してください').max(2000),
  issue_improvements: z.string().min(1, '課題に対しての改善を入力してください').max(2000),
  consultations: z.string().max(2000).optional().or(z.literal('')),

  // コンディション
  concentration_level: z.coerce.number().min(1).max(5).optional(),
  condition_comment: z.string().max(500).optional().or(z.literal('')),
})

export type LeonIsReportFormValues = z.infer<typeof leonIsReportSchema>

// ---- 統合スキーマ ----
export const dailyReportSchema = z.discriminatedUnion('report_type', [
  trainingReportSchema,
  outboundReportSchema,
  inboundReportSchema,
  leonIsReportSchema,
])

export type DailyReportFormValues = z.infer<typeof dailyReportSchema>

// ---- ステータスラベル ----
export const DAILY_REPORT_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  submitted: '提出済',
  approved: '承認済',
  rejected: '差戻し',
}

// ---- ヘルパー: KPI自動計算 ----
export function calcOutboundRates(callCount: number, contactCount: number, appointmentCount: number) {
  return {
    contactRate: callCount > 0 ? Math.round((contactCount / callCount) * 1000) / 10 : 0,
    appointmentRate: callCount > 0 ? Math.round((appointmentCount / callCount) * 1000) / 10 : 0,
  }
}

export function calcInboundRates(receivedCount: number, completedCount: number) {
  return {
    completionRate: receivedCount > 0 ? Math.round((completedCount / receivedCount) * 1000) / 10 : 0,
  }
}
