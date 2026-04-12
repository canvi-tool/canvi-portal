/**
 * アラート無視ルールのチェックユーティリティ
 * オーナーが「無視」設定したアラートパターンを判定する
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface IgnoreRule {
  id: string
  alert_type: string
  staff_id: string | null
  project_id: string | null
  reason: string | null
  created_at: string
}

/**
 * アクティブな無視ルールを全件取得
 */
export async function fetchActiveIgnoreRules(): Promise<IgnoreRule[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('alert_ignores')
    .select('id, alert_type, staff_id, project_id, reason, created_at')
    .eq('is_active', true)

  if (error) {
    console.error('Failed to fetch ignore rules:', error.message)
    return []
  }

  return (data ?? []) as IgnoreRule[]
}

/**
 * 指定のアラートが無視ルールにマッチするか判定
 */
export function isAlertIgnored(
  rules: IgnoreRule[],
  alertType: string,
  staffId?: string | null,
  projectId?: string | null,
): boolean {
  return rules.some((rule) => {
    // alert_type は必須マッチ
    if (rule.alert_type !== alertType) return false
    // staff_id: ルール側がnullなら全スタッフ対象、指定ありならマッチ必須
    if (rule.staff_id && rule.staff_id !== staffId) return false
    // project_id: ルール側がnullなら全PJ対象、指定ありならマッチ必須
    if (rule.project_id && rule.project_id !== projectId) return false
    return true
  })
}
