/**
 * 月額固定計算ルール
 *
 * 固定月額を返す。
 * スタッフの入社日が対象月の途中の場合は、稼働日数で日割り計算する。
 */

import type { CalculationContext, CalculationResult, CalculationLog } from '../types'

interface MonthlyFixedParams {
  amount: number
}

/**
 * 指定月の営業日数（土日を除く）を返す。
 * 簡易実装: 祝日は考慮しない。
 */
function getBusinessDays(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = new Date(year, month - 1, d).getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++
    }
  }
  return count
}

/**
 * startDate 以降の営業日数を返す（startDate の日を含む）。
 */
function getBusinessDaysFrom(year: number, month: number, startDay: number): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = startDay; d <= daysInMonth; d++) {
    const dayOfWeek = new Date(year, month - 1, d).getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++
    }
  }
  return count
}

export function calculateMonthlyFixed(
  context: CalculationContext,
  params: MonthlyFixedParams
): CalculationResult {
  const logs: CalculationLog[] = []
  const fixedAmount = params.amount

  logs.push({
    level: 'info',
    message: `月額固定計算開始: 固定額=${fixedAmount}円`,
  })

  const year = context.year
  const month = context.month

  // Check proration
  const joinDate = context.staff?.hire_date
  let prorated = false
  let prorateRatio = 1

  if (joinDate) {
    const joinDateObj = new Date(joinDate)
    const joinYear = joinDateObj.getFullYear()
    const joinMonth = joinDateObj.getMonth() + 1 // 1-based
    const joinDay = joinDateObj.getDate()

    // 入社が対象月の途中の場合
    if (joinYear === year && joinMonth === month && joinDay > 1) {
      const totalBusinessDays = getBusinessDays(year, month)
      const workedBusinessDays = getBusinessDaysFrom(year, month, joinDay)

      if (totalBusinessDays > 0) {
        prorateRatio = workedBusinessDays / totalBusinessDays
        prorated = true
        logs.push({
          level: 'info',
          message: `入社日割り: 入社日=${joinDate}, 営業日=${workedBusinessDays}/${totalBusinessDays}日, 按分率=${(prorateRatio * 100).toFixed(1)}%`,
        })
      }
    }

    // 入社が対象月より後の場合は0円
    if (joinYear > year || (joinYear === year && joinMonth > month)) {
      logs.push({
        level: 'warning',
        message: `入社日(${joinDate})が対象月(${year}/${month})より後のため0円`,
      })
      return {
        amount: 0,
        inputData: {
          fixed_amount: fixedAmount,
          hire_date: joinDate,
          prorated: false,
          prorate_ratio: 0,
        },
        detail: `月額固定 ${fixedAmount.toLocaleString()}円 (入社前のため対象外)`,
        logs,
      }
    }
  }

  const amount = Math.round(fixedAmount * prorateRatio)

  logs.push({
    level: 'info',
    message: `計算結果: ${fixedAmount}円 x ${(prorateRatio * 100).toFixed(1)}% = ${amount}円`,
  })

  return {
    amount,
    inputData: {
      fixed_amount: fixedAmount,
      hire_date: joinDate ?? null,
      prorated,
      prorate_ratio: prorateRatio,
    },
    detail: prorated
      ? `月額 ${fixedAmount.toLocaleString()}円 x ${(prorateRatio * 100).toFixed(1)}% (日割り)`
      : `月額 ${fixedAmount.toLocaleString()}円`,
    logs,
  }
}
