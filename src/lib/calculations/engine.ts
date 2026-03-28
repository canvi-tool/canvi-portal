/**
 * 支払計算エンジン
 *
 * calculatePaymentForStaff(staffId, yearMonth):
 *   1. スタッフの全アクティブ project_assignments を取得
 *   2. 各アサインメントのアクティブ compensation_rules を priority 順に取得
 *   3. 各ルールについて、該当月の shifts と work_reports を取得
 *   4. CalculationContext を構築
 *   5. ルールタイプに応じた calculator にディスパッチ
 *   6. percentage ルールでは先行計算結果を参照
 *   7. RuleResult 配列を返す
 *
 * calculateMonthlyPayments(yearMonth):
 *   1. 全アクティブスタッフを取得
 *   2. 各スタッフに calculatePaymentForStaff を実行
 *   3. 結果を payment_calculations / payment_calculation_lines に upsert
 *   4. サマリーを返す
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, Json } from '@/lib/types/database'
import type {
  CalculationContext,
  CalculationResult,

  RuleResult,
  StaffPaymentSummary,
  MonthlyCalculationSummary,
  CompensationRuleType,
} from './types'
import { calculateTimeRate } from './rules/time-rate'
import { calculateCountRate } from './rules/count-rate'
import { calculateStandbyRate } from './rules/standby-rate'
import { calculateMonthlyFixed } from './rules/monthly-fixed'
import { calculateFixedPlusVariable } from './rules/fixed-plus-variable'
import { calculatePercentage } from './rules/percentage'
import { calculateAdjustment } from './rules/adjustment'
import { aggregateStaffPayment } from './aggregator'

// ---- Helpers ----

function parseYearMonth(yearMonth: string): { year: number; month: number } {
  const [yearStr, monthStr] = yearMonth.split('-')
  return { year: parseInt(yearStr, 10), month: parseInt(monthStr, 10) }
}

/**
 * ルールの有効期間が対象月と重なるかチェックする。
 */
function isRuleEffective(
  rule: Tables<'compensation_rules'>,
  yearMonth: string
): boolean {
  if (!rule.is_active) return false

  // yearMonth = "2024-06" -> 対象月の初日/末日
  const { year, month } = parseYearMonth(yearMonth)
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0) // 月末日

  if (rule.effective_from) {
    const from = new Date(rule.effective_from)
    // effective_from が月末日より後なら対象外
    if (from > monthEnd) return false
  }

  if (rule.effective_to) {
    const to = new Date(rule.effective_to)
    // effective_to が月初日より前なら対象外
    if (to < monthStart) return false
  }

  return true
}

/**
 * 1つのルールに対してディスパッチして計算する。
 */
function dispatchCalculation(
  ruleType: CompensationRuleType,
  context: CalculationContext,
  params: Record<string, unknown>,
  otherRuleResults: RuleResult[]
): CalculationResult {
  switch (ruleType) {
    case 'time_rate':
      return calculateTimeRate(context, params as unknown as Parameters<typeof calculateTimeRate>[1])
    case 'count_rate':
      return calculateCountRate(context, params as unknown as Parameters<typeof calculateCountRate>[1])
    case 'standby_rate':
      return calculateStandbyRate(context, params as unknown as Parameters<typeof calculateStandbyRate>[1])
    case 'monthly_fixed':
      return calculateMonthlyFixed(context, params as unknown as Parameters<typeof calculateMonthlyFixed>[1])
    case 'fixed_plus_variable':
      return calculateFixedPlusVariable(context, params as unknown as Parameters<typeof calculateFixedPlusVariable>[1])
    case 'percentage':
      return calculatePercentage(context, params as unknown as Parameters<typeof calculatePercentage>[1], otherRuleResults)
    case 'adjustment':
      return calculateAdjustment(context, params as unknown as Parameters<typeof calculateAdjustment>[1])
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = ruleType
      return {
        amount: 0,
        inputData: { error: `未対応のルールタイプ: ${ruleType}` },
        detail: `未対応: ${ruleType}`,
        logs: [{ level: 'error', message: `未対応のルールタイプ: ${ruleType}` }],
      }
    }
  }
}

// ---- Main Functions ----

/**
 * 特定のスタッフ・月の支払いを計算する。
 */
export async function calculatePaymentForStaff(
  supabase: SupabaseClient<Database>,
  staffId: string,
  yearMonth: string
): Promise<RuleResult[]> {
  const { year, month } = parseYearMonth(yearMonth)
  const results: RuleResult[] = []

  // 1. スタッフ情報を取得
  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .eq('id', staffId)
    .single()

  if (!staff) {
    console.warn(`[Engine] スタッフが見つかりません: ${staffId}`)
    return []
  }

  // 2. アクティブなアサインメントを取得
  const { data: assignments } = await supabase
    .from('project_assignments')
    .select('*')
    .eq('staff_id', staffId)
    .in('status', ['active', 'pending'])

  if (!assignments || assignments.length === 0) {
    console.info(`[Engine] ${staff.full_name}: アクティブなアサインメントがありません`)
    return []
  }

  // 3. 各アサインメントのルールを処理
  for (const assignment of assignments) {
    // アサインメント期間チェック
    const monthStart = `${yearMonth}-01`
    const monthEndDate = new Date(year, month, 0)
    const monthEnd = `${yearMonth}-${String(monthEndDate.getDate()).padStart(2, '0')}`

    if (assignment.start_date > monthEnd) continue
    if (assignment.end_date && assignment.end_date < monthStart) continue

    // プロジェクト情報取得
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', assignment.project_id)
      .single()

    // 報酬ルール取得（priority順）
    const { data: rules } = await supabase
      .from('compensation_rules')
      .select('*')
      .eq('assignment_id', assignment.id)
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (!rules || rules.length === 0) continue

    // 勤務報告取得
    const { data: workReport } = await supabase
      .from('work_reports')
      .select('*')
      .eq('staff_id', staffId)
      .eq('year_month', yearMonth)
      .eq('project_id', assignment.project_id)
      .maybeSingle()

    // 業務実績報告取得
    const { data: performanceReport } = await supabase
      .from('performance_reports')
      .select('*')
      .eq('staff_id', staffId)
      .eq('year_month', yearMonth)
      .eq('project_id', assignment.project_id)
      .maybeSingle()

    // シフト取得
    const { data: shifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('staff_id', staffId)
      .eq('project_id', assignment.project_id)
      .gte('date', monthStart)
      .lte('date', monthEnd)

    // 計算コンテキスト構築
    const context: CalculationContext = {
      year,
      month,
      yearMonth,
      staff,
      project: project ?? null,
      assignment,
      workReport: workReport ?? null,
      performanceReport: performanceReport ?? null,
      shifts: shifts ?? [],
    }

    // アサインメント内で先に計算されたルール結果
    const assignmentResults: RuleResult[] = []

    // 4. 各ルールを計算
    for (const rule of rules) {
      // 有効期間チェック
      if (!isRuleEffective(rule, yearMonth)) continue

      const ruleType = rule.rule_type as CompensationRuleType
      const params = (rule.params ?? {}) as Record<string, unknown>

      try {
        const result = dispatchCalculation(
          ruleType,
          context,
          params,
          // percentage ルール用: 同一アサインメント内の先行結果を参照可能にする
          assignmentResults
        )

        const ruleResult: RuleResult = {
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.rule_type,
          priority: rule.priority,
          assignmentId: assignment.id,
          projectId: assignment.project_id,
          projectName: project?.name ?? '(不明)',
          result,
        }

        assignmentResults.push(ruleResult)
        results.push(ruleResult)
      } catch (error) {
        console.error(`[Engine] ルール計算エラー: ${rule.name} (${rule.id})`, error)
        const errorResult: RuleResult = {
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.rule_type,
          priority: rule.priority,
          assignmentId: assignment.id,
          projectId: assignment.project_id,
          projectName: project?.name ?? '(不明)',
          result: {
            amount: 0,
            inputData: { error: String(error) },
            detail: `計算エラー: ${String(error)}`,
            logs: [{ level: 'error', message: `計算エラー: ${String(error)}` }],
          },
        }
        assignmentResults.push(errorResult)
        results.push(errorResult)
      }
    }
  }

  return results
}

/**
 * 月次計算を実行し、結果をDBに保存する。
 */
export async function calculateMonthlyPayments(
  supabase: SupabaseClient<Database>,
  yearMonth: string
): Promise<MonthlyCalculationSummary> {
  const calculatedAt = new Date().toISOString()

  // 1. 全アクティブスタッフを取得
  const { data: staffList, error: staffError } = await supabase
    .from('staff')
    .select('*')
    .eq('status', 'active')
    .order('full_name')

  if (staffError) {
    throw new Error(`スタッフ取得エラー: ${staffError.message}`)
  }

  if (!staffList || staffList.length === 0) {
    return {
      yearMonth,
      staffResults: [],
      totalStaff: 0,
      totalAmount: 0,
      calculatedAt,
    }
  }

  // 2. 各スタッフの計算を実行
  const staffResults: StaffPaymentSummary[] = []

  for (const staff of staffList) {
    const ruleResults = await calculatePaymentForStaff(supabase, staff.id, yearMonth)

    if (ruleResults.length === 0) continue

    // 集計
    const summary = aggregateStaffPayment(staff, ruleResults)
    staffResults.push(summary)

    // 3. DB に upsert
    // payment_calculations のupsert
    const { data: existingCalc } = await supabase
      .from('payment_calculations')
      .select('id')
      .eq('staff_id', staff.id)
      .eq('year_month', yearMonth)
      .maybeSingle()

    let paymentCalcId: string

    if (existingCalc) {
      // 既存の計算を更新（ただし確定済み以上は更新しない）
      const { data: currentCalc } = await supabase
        .from('payment_calculations')
        .select('status')
        .eq('id', existingCalc.id)
        .single()

      if (currentCalc && (currentCalc.status === 'confirmed' || currentCalc.status === 'issued')) {
        console.warn(`[Engine] ${staff.full_name}: 確定済みのため更新スキップ`)
        continue
      }

      const { error: updateError } = await supabase
        .from('payment_calculations')
        .update({
          total_amount: summary.totalAmount,
          status: 'aggregated',
          calculated_at: calculatedAt,
          notes: null,
        })
        .eq('id', existingCalc.id)

      if (updateError) {
        console.error(`[Engine] payment_calculations 更新エラー: ${updateError.message}`)
        continue
      }

      paymentCalcId = existingCalc.id

      // 既存の明細行を削除して再作成
      await supabase
        .from('payment_calculation_lines')
        .delete()
        .eq('payment_calculation_id', paymentCalcId)
    } else {
      // 新規作成
      const { data: newCalc, error: insertError } = await supabase
        .from('payment_calculations')
        .insert({
          staff_id: staff.id,
          year_month: yearMonth,
          total_amount: summary.totalAmount,
          status: 'aggregated',
          calculated_at: calculatedAt,
        })
        .select('id')
        .single()

      if (insertError || !newCalc) {
        console.error(`[Engine] payment_calculations 作成エラー: ${insertError?.message}`)
        continue
      }

      paymentCalcId = newCalc.id
    }

    // payment_calculation_lines の作成
    let sortOrder = 0
    for (const project of summary.projects) {
      for (const line of project.lines) {
        sortOrder++
        await supabase.from('payment_calculation_lines').insert({
          payment_calculation_id: paymentCalcId,
          compensation_rule_id: line.ruleId,
          rule_name: line.ruleName,
          rule_type: line.ruleType,
          amount: line.result.amount,
          input_data: line.result.inputData as Json,
          detail: line.result.detail,
          sort_order: sortOrder,
        })
      }
    }

    // 消費税行がある場合
    if (summary.taxAmount > 0) {
      sortOrder++
      await supabase.from('payment_calculation_lines').insert({
        payment_calculation_id: paymentCalcId,
        compensation_rule_id: null,
        rule_name: `消費税 (${summary.taxRate * 100}%)`,
        rule_type: 'tax',
        amount: summary.taxAmount,
        input_data: {
          subtotal: summary.subtotal,
          tax_rate: summary.taxRate,
        } as Json,
        detail: `小計 ${summary.subtotal.toLocaleString()}円 x ${summary.taxRate * 100}%`,
        sort_order: sortOrder,
      })
    }
  }

  // 4. サマリーを返す
  const totalAmount = staffResults.reduce((sum, s) => sum + s.totalAmount, 0)

  return {
    yearMonth,
    staffResults,
    totalStaff: staffResults.length,
    totalAmount,
    calculatedAt,
  }
}
