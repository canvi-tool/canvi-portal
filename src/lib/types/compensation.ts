import type { CompensationRuleType } from './enums'

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

export type CompensationParams =
  | TimeRateParams
  | CountRateParams
  | StandbyRateParams
  | MonthlyFixedParams
  | FixedPlusVariableParams
  | PercentageParams
  | AdjustmentParams

export interface CalculationContext {
  yearMonth: string
  staffId: string
  assignmentId: string
  totalHours: number
  overtimeHours: number
  callCount: number
  appointmentCount: number
  otherCounts: Record<string, number>
  standbyHours: number
  standbyDays: number
  workingDays: number
  otherRuleResults: CalculationResult[]
}

export interface CalculationResult {
  ruleId: string
  ruleName: string
  ruleType: CompensationRuleType
  amount: number
  inputData: Record<string, unknown>
  detail: string
}
