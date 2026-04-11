/**
 * 時間単価計算ルール
 *
 * 勤怠レコード(attendance_records)の clock_in / clock_out / break_minutes から
 * 実労働時間を算出し、時間単価で報酬を計算する。
 * 残業時間がある場合は、閾値を超えた分に対して残業倍率を適用する。
 */

import type { CalculationContext, CalculationResult, CalculationLog } from '../types'

interface TimeRateParams {
  rate_per_hour: number
  overtime_multiplier?: number
  overtime_threshold_hours?: number
}

/**
 * 勤怠レコードから月間の総労働時間を集計する
 */
function calculateTotalHoursFromAttendance(context: CalculationContext): number {
  const records = context.attendanceRecords || []
  let totalMinutes = 0

  for (const record of records) {
    // work_minutes が計算済みならそれを使う
    if (record.work_minutes && record.work_minutes > 0) {
      totalMinutes += record.work_minutes
      continue
    }

    // clock_in/clock_out から計算
    if (record.clock_in && record.clock_out) {
      const clockIn = new Date(record.clock_in)
      const clockOut = new Date(record.clock_out)
      const diffMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60)
      const breakMinutes = record.break_minutes ?? 0
      const workMinutes = Math.max(0, diffMinutes - breakMinutes)
      totalMinutes += workMinutes
    }
  }

  return totalMinutes / 60 // 時間に変換
}

export function calculateTimeRate(
  context: CalculationContext,
  params: TimeRateParams
): CalculationResult {
  const logs: CalculationLog[] = []
  const ratePerHour = params.rate_per_hour
  const overtimeMultiplier = params.overtime_multiplier ?? 1.25
  const overtimeThreshold = params.overtime_threshold_hours ?? 160

  // 勤怠レコードから実労働時間を集計
  const totalHours = calculateTotalHoursFromAttendance(context)
  const attendanceCount = (context.attendanceRecords || []).length

  logs.push({
    level: 'info',
    message: `時間単価計算開始: 勤怠レコード=${attendanceCount}件, 総時間=${totalHours.toFixed(2)}h, 単価=${ratePerHour}円/h`,
  })

  if (totalHours === 0 && attendanceCount === 0) {
    logs.push({
      level: 'warning',
      message: '勤怠レコードがありません。シフトデータからの推定は行いません。',
    })
  }

  // Calculate based on threshold
  const regularHours = Math.min(totalHours, overtimeThreshold)
  const overtimeHours = Math.max(0, totalHours - overtimeThreshold)

  logs.push({
    level: 'info',
    message: `閾値ベース計算: 閾値=${overtimeThreshold}h, 通常=${regularHours.toFixed(2)}h, 残業=${overtimeHours.toFixed(2)}h`,
  })

  const regularAmount = regularHours * ratePerHour
  const overtimeAmount = overtimeHours * ratePerHour * overtimeMultiplier
  const amount = regularAmount + overtimeAmount

  // Round to integer (yen)
  const roundedAmount = Math.round(amount)

  logs.push({
    level: 'info',
    message: `計算結果: 通常(${regularHours.toFixed(2)}h x ${ratePerHour}円)=${Math.round(regularAmount)}円 + 残業(${overtimeHours.toFixed(2)}h x ${ratePerHour}円 x ${overtimeMultiplier})=${Math.round(overtimeAmount)}円 = ${roundedAmount}円`,
  })

  return {
    amount: roundedAmount,
    inputData: {
      attendance_count: attendanceCount,
      total_hours: Math.round(totalHours * 100) / 100,
      regular_hours: Math.round(regularHours * 100) / 100,
      overtime_hours: Math.round(overtimeHours * 100) / 100,
      rate_per_hour: ratePerHour,
      overtime_multiplier: overtimeMultiplier,
      overtime_threshold_hours: overtimeThreshold,
    },
    detail: `${regularHours.toFixed(1)}h x ${ratePerHour.toLocaleString()}円${overtimeHours > 0 ? ` + 残業${overtimeHours.toFixed(1)}h x ${ratePerHour.toLocaleString()}円 x ${overtimeMultiplier}` : ''}`,
    logs,
  }
}
