/**
 * 固定+変動計算ルール
 *
 * 固定額に加え、変動単位の件数 x 変動単価を加算する。
 * 変動部分の件数は count-rate と同様に、業務報告・勤怠等から取得する。
 */

import type { CalculationContext, CalculationResult, CalculationLog } from '../types'

interface FixedPlusVariableParams {
  fixed_amount: number
  variable_unit: string
  variable_rate: number
}

/**
 * unit_name に一致する件数を取得する（count-rate と同じロジック）。
 */
function resolveCount(context: CalculationContext, unitName: string): number {
  const normalized = unitName.toLowerCase().trim()

  // 勤務日数
  if (normalized === 'days' || normalized === '勤務日数' || normalized === '出勤日数') {
    return (context.attendanceRecords || []).length
  }

  // 日報件数
  if (normalized === 'report' || normalized === '日報' || normalized === '報告') {
    return (context.workReports || []).length
  }

  // シフト件数
  if (normalized === 'shift' || normalized === 'シフト' || normalized === 'シフト数') {
    return (context.shifts || []).length
  }

  // performance_report の summary から検索
  const perf = context.performanceReport
  if (perf) {
    const summary = perf.summary as Record<string, unknown> | null
    if (summary && typeof summary === 'object') {
      if (normalized in summary) {
        return Number(summary[normalized]) || 0
      }
      for (const [key, value] of Object.entries(summary)) {
        if (key.toLowerCase().trim() === normalized) {
          return Number(value) || 0
        }
      }
    }
  }

  // work_reports の custom_fields から集計
  const reports = context.workReports || []
  let totalCount = 0
  for (const report of reports) {
    const cf = report.custom_fields as Record<string, unknown> | null
    if (cf && typeof cf === 'object') {
      for (const [key, value] of Object.entries(cf)) {
        if (key.toLowerCase().trim() === normalized) {
          totalCount += Number(value) || 0
        }
      }
    }
  }
  if (totalCount > 0) return totalCount

  // フォールバック: 勤怠レコード数
  return (context.attendanceRecords || []).length
}

export function calculateFixedPlusVariable(
  context: CalculationContext,
  params: FixedPlusVariableParams
): CalculationResult {
  const logs: CalculationLog[] = []
  const { fixed_amount, variable_unit, variable_rate } = params

  logs.push({
    level: 'info',
    message: `固定+変動計算開始: 固定額=${fixed_amount}円, 変動単位="${variable_unit}", 変動単価=${variable_rate}円`,
  })

  const count = resolveCount(context, variable_unit)
  const variableAmount = count * variable_rate

  logs.push({
    level: 'info',
    message: `変動部分: ${variable_unit}=${count}件 x ${variable_rate}円 = ${variableAmount}円`,
  })

  const amount = Math.round(fixed_amount + variableAmount)

  logs.push({
    level: 'info',
    message: `計算結果: 固定${fixed_amount}円 + 変動${variableAmount}円 = ${amount}円`,
  })

  return {
    amount,
    inputData: {
      fixed_amount,
      variable_unit,
      variable_rate,
      variable_count: count,
      variable_amount: variableAmount,
    },
    detail: `固定 ${fixed_amount.toLocaleString()}円 + ${variable_unit} ${count}件 x ${variable_rate.toLocaleString()}円`,
    logs,
  }
}
