/**
 * 日次報告 custom_fields のキーマッピング
 *
 * 報酬ルールの unit_name（日本語）を work_reports.custom_fields の
 * 実際のキー名（英語）にマッピングする。
 * 複数のキーにマッチする場合は最初に見つかったものを使用。
 */

import type { CalculationContext } from '../types'

/**
 * 日本語 unit_name → custom_fields キー名のマッピング
 * 配列の先頭が優先される
 */
const UNIT_NAME_TO_CUSTOM_FIELD_KEYS: Record<string, string[]> = {
  // テレアポ系
  '架電数': ['daily_call_count_actual'],
  '架電件数': ['daily_call_count_actual'],
  '架電': ['daily_call_count_actual'],
  'アポ数': ['daily_appointment_count'],
  'アポ件数': ['daily_appointment_count'],
  'アポ': ['daily_appointment_count'],
  '通電数': ['daily_contact_count'],
  '通電件数': ['daily_contact_count'],

  // インバウンド系
  '受電数': ['daily_received_count'],
  '受電件数': ['daily_received_count'],
  '受電': ['daily_received_count'],
  '対応完了数': ['daily_completed_count'],
  '対応完了': ['daily_completed_count'],
  'エスカレーション': ['daily_escalation_count'],
  '対応時間': ['daily_avg_handle_time'],

  // ISR/SDR系
  '即時架電数': ['immediate_call_count'],
  '即時架電': ['immediate_call_count'],
  '通常架電数': ['followup_call_count'],
  '通常架電': ['followup_call_count'],
  'slack通知数': ['slack_notified_count'],
  'slack通知': ['slack_notified_count'],
  '契約件数': ['contract_zoom_count'],
  '契約': ['contract_zoom_count'],
}

/**
 * unit_name に一致する件数を CalculationContext から取得する。
 *
 * 検索順序:
 * 1. 勤務日数・日報・シフト等の既知キーワード
 * 2. 日本語 unit_name → custom_fields キーマッピング（work_reports から集計）
 * 3. performance_report.summary からの直接検索
 * 4. work_reports.custom_fields からの直接検索（キー名完全一致）
 * 5. フォールバック: 勤怠レコード数
 */
export function resolveCount(context: CalculationContext, unitName: string): number {
  const normalized = unitName.toLowerCase().trim()

  // 1. 勤務日数
  if (normalized === 'days' || normalized === '勤務日数' || normalized === '出勤日数') {
    return (context.attendanceRecords || []).length
  }

  // 日報件数
  if (normalized === 'report' || normalized === '日報' || normalized === '報告' || normalized === '日報件数') {
    return (context.workReports || []).length
  }

  // シフト件数
  if (normalized === 'shift' || normalized === 'シフト' || normalized === 'シフト数') {
    return (context.shifts || []).length
  }

  // 2. 日本語 → custom_fields キーマッピング経由で work_reports から集計
  const mappedKeys = UNIT_NAME_TO_CUSTOM_FIELD_KEYS[normalized] ||
    UNIT_NAME_TO_CUSTOM_FIELD_KEYS[unitName.trim()]

  if (mappedKeys) {
    const reports = context.workReports || []
    let total = 0
    for (const report of reports) {
      const cf = report.custom_fields as Record<string, unknown> | null
      if (cf && typeof cf === 'object') {
        for (const key of mappedKeys) {
          if (key in cf) {
            total += Number(cf[key]) || 0
            break // 最初にマッチしたキーのみ使用
          }
        }
      }
    }
    if (total > 0) return total
  }

  // 3. performance_report の summary から検索
  const perf = context.performanceReport
  if (perf) {
    const summary = perf.summary as Record<string, unknown> | null
    if (summary && typeof summary === 'object') {
      if (normalized in summary) {
        return Number(summary[normalized]) || 0
      }
      for (const [key, value] of Object.entries(summary)) {
        if (key.toLowerCase().trim() === normalized) {
          return Number(value) || 0
        }
      }
    }
  }

  // 4. work_reports の custom_fields から直接キー名で集計
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

  // 5. フォールバック: 勤怠レコード数
  return (context.attendanceRecords || []).length
}
