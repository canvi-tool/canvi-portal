/**
 * 件数単価計算ルール
 *
 * 日次業務報告(work_reports)の件数をもとに報酬を計算する。
 * unit_name で件数の算出元を指定：
 *   - "勤務日数" / "days" → 勤怠レコード数
 *   - "日報" / "report" → 業務報告件数
 *   - "架電数" / "アポ数" 等 → work_reports.custom_fields から集計
 *   - その他 → work_reports の custom_fields キー名で直接検索
 * minimum_count が設定されている場合は、実件数と最低件数の大きい方を採用する。
 */

import type { CalculationContext, CalculationResult, CalculationLog } from '../types'
import { resolveCount } from './unit-resolver'

interface CountRateParams {
  unit_name: string
  rate_per_unit: number
  minimum_count?: number
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
