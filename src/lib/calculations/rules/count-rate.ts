/**
 * 件数単価計算ルール
 *
 * 日次業務報告(work_reports)の件数をもとに報酬を計算する。
 * unit_name で件数の算出元を指定：
 *   - "勤務日数" / "days" → 勤怠レコード数
 *   - "日報" / "report" → 業務報告件数
 *   - その他 → work_reports の custom_fields から検索
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

  // performance_reportのsummaryからの検索（JSONフィールド）
  const perf = context.performanceReport
  if (perf) {
    const summary = perf.summary as Record<string, unknown> | null
    if (summary && typeof summary === 'object') {
      // 完全一致
      if (normalized in summary) {
        return Number(summary[normalized]) || 0
      }
      // キーの大文字小文字を無視して検索
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
