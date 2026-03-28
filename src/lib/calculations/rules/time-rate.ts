/**
 * 時間単価計算ルール
 *
 * 勤務報告の総時間をもとに報酬を計算する。
 * 残業時間がある場合は、閾値を超えた分に対して残業倍率を適用する。
 */

import type { CalculationContext, CalculationResult, CalculationLog } from '../types'

interface TimeRateParams {
  rate_per_hour: number
  overtime_multiplier?: number
  overtime_threshold_hours?: number
}

export function calculateTimeRate(
  context: CalculationContext,
  params: TimeRateParams
): CalculationResult {
  const logs: CalculationLog[] = []
  const ratePerHour = params.rate_per_hour
  const overtimeMultiplier = params.overtime_multiplier ?? 1.25
  const overtimeThreshold = params.overtime_threshold_hours ?? 160

  const totalHours = context.workReport?.total_hours ?? 0
  const reportOvertimeHours = context.workReport?.overtime_hours ?? 0

  logs.push({
    level: 'info',
    message: `時間単価計算開始: 総時間=${totalHours}h, 報告残業=${reportOvertimeHours}h, 単価=${ratePerHour}円/h`,
  })

  // If overtime hours are explicitly reported, use those
  // Otherwise, calculate based on threshold
  let regularHours: number
  let overtimeHours: number

  if (reportOvertimeHours > 0) {
    // Trust the reported overtime hours
    regularHours = totalHours - reportOvertimeHours
    overtimeHours = reportOvertimeHours
    logs.push({
      level: 'info',
      message: `報告済み残業時間を使用: 通常=${regularHours}h, 残業=${overtimeHours}h`,
    })
  } else {
    // Calculate based on threshold
    regularHours = Math.min(totalHours, overtimeThreshold)
    overtimeHours = Math.max(0, totalHours - overtimeThreshold)
    logs.push({
      level: 'info',
      message: `閾値ベース計算: 閾値=${overtimeThreshold}h, 通常=${regularHours}h, 残業=${overtimeHours}h`,
    })
  }

  // Guard against negative values
  regularHours = Math.max(0, regularHours)
  overtimeHours = Math.max(0, overtimeHours)

  const regularAmount = regularHours * ratePerHour
  const overtimeAmount = overtimeHours * ratePerHour * overtimeMultiplier
  const amount = regularAmount + overtimeAmount

  // Round to integer (yen)
  const roundedAmount = Math.round(amount)

  logs.push({
    level: 'info',
    message: `計算結果: 通常(${regularHours}h x ${ratePerHour}円)=${regularAmount}円 + 残業(${overtimeHours}h x ${ratePerHour}円 x ${overtimeMultiplier})=${overtimeAmount}円 = ${roundedAmount}円`,
  })

  return {
    amount: roundedAmount,
    inputData: {
      total_hours: totalHours,
      regular_hours: regularHours,
      overtime_hours: overtimeHours,
      rate_per_hour: ratePerHour,
      overtime_multiplier: overtimeMultiplier,
      overtime_threshold_hours: overtimeThreshold,
    },
    detail: `${regularHours}h x ${ratePerHour.toLocaleString()}円 + 残業${overtimeHours}h x ${ratePerHour.toLocaleString()}円 x ${overtimeMultiplier}`,
    logs,
  }
}
