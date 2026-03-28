/**
 * 調整/経費計算ルール
 *
 * 手動で設定された調整金額をそのまま返す。
 * 正の値（追加手当）も負の値（控除）もサポートする。
 */

import type { CalculationContext, CalculationResult, CalculationLog } from '../types'

interface AdjustmentParams {
  amount: number
  reason: string
}

export function calculateAdjustment(
  _context: CalculationContext,
  params: AdjustmentParams
): CalculationResult {
  const logs: CalculationLog[] = []
  const { amount, reason } = params

  logs.push({
    level: 'info',
    message: `調整計算: 金額=${amount}円, 理由="${reason}"`,
  })

  // Amount can be negative (deduction) or positive (addition)
  const roundedAmount = Math.round(amount)

  const prefix = roundedAmount >= 0 ? '加算' : '控除'

  logs.push({
    level: 'info',
    message: `計算結果: ${prefix} ${Math.abs(roundedAmount)}円`,
  })

  return {
    amount: roundedAmount,
    inputData: {
      amount: roundedAmount,
      reason,
    },
    detail: `${prefix}: ${reason} (${roundedAmount >= 0 ? '+' : ''}${roundedAmount.toLocaleString()}円)`,
    logs,
  }
}
