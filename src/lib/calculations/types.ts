/**
 * 支払計算エンジンの型定義
 */

import type { Tables } from '@/lib/types/database'

// ---- Input Types ----

/**
 * 計算コンテキスト: 1つのアサインメント/ルールに対する計算に必要なデータ
 */
export interface CalculationContext {
  /** 対象年 */
  year: number
  /** 対象月 (1-12) */
  month: number
  /** 対象年月文字列 "YYYY-MM" */
  yearMonth: string
  /** スタッフ情報 */
  staff: Tables<'staff'> | null
  /** プロジェクト情報 */
  project: Tables<'projects'> | null
  /** アサインメント情報 */
  assignment: Tables<'project_assignments'> | null
  /** 勤務報告（該当月・該当PJ）- 日次業務報告 */
  workReports: Tables<'work_reports'>[]
  /** 業務実績報告（該当月・該当PJ） */
  performanceReport: Tables<'performance_reports'> | null
  /** シフトデータ（該当月・該当PJ） */
  shifts: Tables<'shifts'>[]
  /** 勤怠レコード（該当月・該当PJ） */
  attendanceRecords: Tables<'attendance_records'>[]
}

// ---- Output Types ----

export interface CalculationLog {
  level: 'info' | 'warning' | 'error'
  message: string
}

export interface CalculationResult {
  /** 計算された金額（円）。負の値も可能（控除の場合）。 */
  amount: number
  /** 計算に使用した入力データ */
  inputData: Record<string, unknown>
  /** 人間が読める計算明細 */
  detail: string
  /** 計算ログ */
  logs: CalculationLog[]
}

/**
 * 1つのルールの計算結果を格納する構造体
 */
export interface RuleResult {
  ruleId: string
  ruleName: string
  ruleType: string
  priority: number
  assignmentId: string
  projectId: string
  projectName: string
  result: CalculationResult
}

// ---- Aggregated Types ----

export interface ProjectPaymentSummary {
  projectId: string
  projectName: string
  lines: RuleResult[]
  subtotal: number
}

export interface StaffPaymentSummary {
  staffId: string
  staffName: string
  employmentType: string
  projects: ProjectPaymentSummary[]
  /** 税抜き合計 */
  subtotal: number
  /** 消費税額（業務委託/フリーランスの場合のみ） */
  taxAmount: number
  /** 消費税率 */
  taxRate: number
  /** 税込み合計（最終支払額） */
  totalAmount: number
  /** 計算ログ一覧 */
  logs: CalculationLog[]
}

export interface MonthlyCalculationSummary {
  yearMonth: string
  staffResults: StaffPaymentSummary[]
  totalStaff: number
  totalAmount: number
  calculatedAt: string
}

// ---- Rule Params Types (for typed access) ----

export interface TimeRateParams {
  rate_per_hour: number
  overtime_multiplier?: number
  overtime_threshold_hours?: number
}

export interface CountRateParams {
  unit_name: string
  rate_per_unit: number
  minimum_count?: number
}

export interface StandbyRateParams {
  rate_per_hour?: number
  rate_per_day?: number
}

export interface MonthlyFixedParams {
  amount: number
}

export interface FixedPlusVariableParams {
  fixed_amount: number
  variable_unit: string
  variable_rate: number
}

export interface PercentageParams {
  base_rule_id: string
  percentage: number
  description?: string
}

export interface AdjustmentParams {
  amount: number
  reason: string
}

export type CompensationRuleType =
  | 'time_rate'
  | 'count_rate'
  | 'standby_rate'
  | 'monthly_fixed'
  | 'fixed_plus_variable'
  | 'percentage'
  | 'adjustment'
