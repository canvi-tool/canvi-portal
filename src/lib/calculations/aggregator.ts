/**
 * 支払集計モジュール
 *
 * スタッフの全 RuleResult を受け取り、
 * プロジェクト別にグループ化し、小計・消費税・合計を計算する。
 *
 * 消費税の扱い:
 * - employee (社員): 消費税なし
 * - contractor (契約社員): 消費税なし
 * - freelancer (フリーランス/業務委託): 消費税 10% を加算
 */

import type { Tables } from '@/lib/types/database'
import type {
  RuleResult,
  StaffPaymentSummary,
  ProjectPaymentSummary,
  CalculationLog,
} from './types'

/** 消費税率 (2024年時点) */
const CONSUMPTION_TAX_RATE = 0.1

/**
 * 消費税対象かどうかを判定する。
 * フリーランス/業務委託のみ消費税を適用。
 */
function isTaxApplicable(employmentType: string): boolean {
  return employmentType === 'freelancer'
}

/**
 * RuleResult 配列をプロジェクト別にグループ化する。
 */
function groupByProject(results: RuleResult[]): Map<string, RuleResult[]> {
  const map = new Map<string, RuleResult[]>()
  for (const r of results) {
    const key = r.projectId
    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key)!.push(r)
  }
  return map
}

/**
 * スタッフの支払いを集計する。
 */
export function aggregateStaffPayment(
  staff: Tables<'staff'>,
  ruleResults: RuleResult[]
): StaffPaymentSummary {
  const logs: CalculationLog[] = []

  logs.push({
    level: 'info',
    message: `集計開始: ${staff.last_name} ${staff.first_name} (${staff.employment_type})`,
  })

  // プロジェクト別にグループ化
  const grouped = groupByProject(ruleResults)
  const projects: ProjectPaymentSummary[] = []

  for (const [projectId, lines] of grouped) {
    const projectName = lines[0]?.projectName ?? '(不明)'
    const subtotal = lines.reduce((sum, l) => sum + l.result.amount, 0)

    projects.push({
      projectId,
      projectName,
      lines,
      subtotal,
    })

    logs.push({
      level: 'info',
      message: `PJ "${projectName}": ${lines.length}件のルール, 小計=${subtotal.toLocaleString()}円`,
    })
  }

  // 全プロジェクト合計（税抜き）
  const subtotal = projects.reduce((sum, p) => sum + p.subtotal, 0)

  // 消費税計算
  const applyTax = isTaxApplicable(staff.employment_type)
  const taxRate = applyTax ? CONSUMPTION_TAX_RATE : 0
  const taxAmount = applyTax ? Math.round(subtotal * taxRate) : 0
  const totalAmount = subtotal + taxAmount

  if (applyTax) {
    logs.push({
      level: 'info',
      message: `消費税: ${subtotal.toLocaleString()}円 x ${taxRate * 100}% = ${taxAmount.toLocaleString()}円`,
    })
  }

  logs.push({
    level: 'info',
    message: `集計完了: 小計=${subtotal.toLocaleString()}円, 税=${taxAmount.toLocaleString()}円, 合計=${totalAmount.toLocaleString()}円`,
  })

  return {
    staffId: staff.id,
    staffName: `${staff.last_name} ${staff.first_name}`,
    employmentType: staff.employment_type,
    projects,
    subtotal,
    taxAmount,
    taxRate,
    totalAmount,
    logs,
  }
}
