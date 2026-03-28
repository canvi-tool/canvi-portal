/**
 * 件数単価計算ルール
 *
 * 業務実績報告の件数データ（call_count, appointment_count, other_counts）を用いて
 * unit_name に一致する項目の件数 x 単価で報酬を計算する。
 * minimum_count が設定されている場合は、実件数と最低件数の大きい方を採用する。
 */

import type { CalculationContext, CalculationResult, CalculationLog } from '../types'

interface CountRateParams {
  unit_name: string
  rate_per_unit: number
  minimum_count?: number
}

/**
 * unit_name に一致する件数を CalculationContext から取得する。
 * 既知の unit_name: "call" -> call_count, "appointment" -> appointment_count
 * それ以外は other_counts の中から検索する。
 */
function resolveCount(context: CalculationContext, unitName: string): number {
  const perf = context.performanceReport

  if (!perf) return 0

  const normalized = unitName.toLowerCase().trim()

  // 既知のフィールドマッピング
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

  // other_counts からの検索
  const otherCounts = perf.other_counts as Record<string, number> | null
  if (otherCounts && typeof otherCounts === 'object') {
    // 完全一致
    if (normalized in otherCounts) {
      return Number(otherCounts[normalized]) || 0
    }
    // キーの大文字小文字を無視して検索
    for (const [key, value] of Object.entries(otherCounts)) {
      if (key.toLowerCase().trim() === normalized) {
        return Number(value) || 0
      }
    }
  }

  return 0
}

export function calculateCountRate(
  context: CalculationContext,
  params: CountRateParams
): CalculationResult {
  const logs: CalculationLog[] = []
  const { unit_name, rate_per_unit, minimum_count = 0 } = params

  const rawCount = resolveCount(context, unit_name)

  logs.push({
    level: 'info',
    message: `件数単価計算開始: 単位名="${unit_name}", 実件数=${rawCount}, 最低件数=${minimum_count}, 単価=${rate_per_unit}円`,
  })

  // Apply minimum count
  const effectiveCount = Math.max(rawCount, minimum_count)

  if (effectiveCount > rawCount) {
    logs.push({
      level: 'info',
      message: `最低件数を適用: ${rawCount} -> ${effectiveCount}`,
    })
  }

  const amount = Math.round(effectiveCount * rate_per_unit)

  logs.push({
    level: 'info',
    message: `計算結果: ${effectiveCount}件 x ${rate_per_unit}円 = ${amount}円`,
  })

  return {
    amount,
    inputData: {
      unit_name,
      raw_count: rawCount,
      effective_count: effectiveCount,
      minimum_count,
      rate_per_unit,
    },
    detail: `${unit_name}: ${effectiveCount}件 x ${rate_per_unit.toLocaleString()}円`,
    logs,
  }
}
