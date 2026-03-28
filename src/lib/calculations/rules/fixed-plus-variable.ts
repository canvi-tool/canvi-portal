/**
 * 固定+変動計算ルール
 *
 * 固定額に加え、変動単位の件数 x 変動単価を加算する。
 * 変動部分の件数は count-rate と同様に、業務実績報告から取得する。
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
  const perf = context.performanceReport
  if (!perf) return 0

  const normalized = unitName.toLowerCase().trim()

  if (normalized === 'call' || normalized === 'コール' || normalized === 'コール数') {
    return perf.call_count ?? 0
  }
  if (
    normalized === 'appointment' ||
    normalized === 'アポ' ||
    normalized === 'アポイント' ||
    normalized === 'アポ数'
  ) {
    return perf.appointment_count ?? 0
  }

  const otherCounts = perf.other_counts as Record<string, number> | null
  if (otherCounts && typeof otherCounts === 'object') {
    if (normalized in otherCounts) {
      return Number(otherCounts[normalized]) || 0
    }
    for (const [key, value] of Object.entries(otherCounts)) {
      if (key.toLowerCase().trim() === normalized) {
        return Number(value) || 0
      }
    }
  }

  return 0
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
