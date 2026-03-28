/**
 * 待機単価計算ルール
 *
 * 勤務報告の待機時間/日数をもとに報酬を計算する。
 * rate_per_hour と rate_per_day の両方が設定されている場合は、両方を加算する。
 */

import type { CalculationContext, CalculationResult, CalculationLog } from '../types'

interface StandbyRateParams {
  rate_per_hour?: number
  rate_per_day?: number
}

export function calculateStandbyRate(
  context: CalculationContext,
  params: StandbyRateParams
): CalculationResult {
  const logs: CalculationLog[] = []
  const { rate_per_hour = 0, rate_per_day = 0 } = params

  const standbyHours = context.workReport?.standby_hours ?? 0
  const standbyDays = context.workReport?.standby_days ?? 0

  logs.push({
    level: 'info',
    message: `待機計算開始: 待機時間=${standbyHours}h, 待機日数=${standbyDays}日, 時間単価=${rate_per_hour}円/h, 日額=${rate_per_day}円/日`,
  })

  let amount = 0
  const parts: string[] = []

  if (rate_per_hour > 0 && standbyHours > 0) {
    const hourlyAmount = standbyHours * rate_per_hour
    amount += hourlyAmount
    parts.push(`待機${standbyHours}h x ${rate_per_hour.toLocaleString()}円`)
    logs.push({
      level: 'info',
      message: `時間ベース: ${standbyHours}h x ${rate_per_hour}円 = ${hourlyAmount}円`,
    })
  }

  if (rate_per_day > 0 && standbyDays > 0) {
    const dailyAmount = standbyDays * rate_per_day
    amount += dailyAmount
    parts.push(`待機${standbyDays}日 x ${rate_per_day.toLocaleString()}円`)
    logs.push({
      level: 'info',
      message: `日額ベース: ${standbyDays}日 x ${rate_per_day}円 = ${dailyAmount}円`,
    })
  }

  const roundedAmount = Math.round(amount)

  if (amount === 0) {
    logs.push({
      level: 'warning',
      message: '待機時間/日数が0のため、計算結果は0円です',
    })
  }

  logs.push({
    level: 'info',
    message: `計算結果: ${roundedAmount}円`,
  })

  return {
    amount: roundedAmount,
    inputData: {
      standby_hours: standbyHours,
      standby_days: standbyDays,
      rate_per_hour,
      rate_per_day,
    },
    detail: parts.length > 0 ? parts.join(' + ') : '待機なし',
    logs,
  }
}
