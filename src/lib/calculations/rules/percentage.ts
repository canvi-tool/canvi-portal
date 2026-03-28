/**
 * 率計算ルール
 *
 * 他のルール（base_rule_id）の計算結果を基準にして、指定された割合を計算する。
 * 例: 交通費の10%をインセンティブとして付与、等。
 */

import type { CalculationContext, CalculationResult, CalculationLog, RuleResult } from '../types'

interface PercentageParams {
  base_rule_id: string
  percentage: number
  description?: string
}

export function calculatePercentage(
  context: CalculationContext,
  params: PercentageParams,
  otherRuleResults: RuleResult[]
): CalculationResult {
  const logs: CalculationLog[] = []
  const { base_rule_id, percentage, description } = params

  logs.push({
    level: 'info',
    message: `率計算開始: 基準ルールID="${base_rule_id}", 率=${percentage}%`,
  })

  // Find the base rule result
  const baseResult = otherRuleResults.find((r) => r.ruleId === base_rule_id)

  if (!baseResult) {
    logs.push({
      level: 'error',
      message: `基準ルール(${base_rule_id})の計算結果が見つかりません。0円として処理します。`,
    })
    return {
      amount: 0,
      inputData: {
        base_rule_id,
        base_rule_name: null,
        base_amount: 0,
        percentage,
        error: '基準ルールが見つかりません',
      },
      detail: description || `率計算 (基準ルール未検出)`,
      logs,
    }
  }

  const baseAmount = baseResult.result.amount

  logs.push({
    level: 'info',
    message: `基準ルール "${baseResult.ruleName}" の金額: ${baseAmount}円`,
  })

  const amount = Math.round(baseAmount * percentage / 100)

  logs.push({
    level: 'info',
    message: `計算結果: ${baseAmount}円 x ${percentage}% = ${amount}円`,
  })

  return {
    amount,
    inputData: {
      base_rule_id,
      base_rule_name: baseResult.ruleName,
      base_amount: baseAmount,
      percentage,
    },
    detail: description || `${baseResult.ruleName} ${baseAmount.toLocaleString()}円 x ${percentage}%`,
    logs,
  }
}
