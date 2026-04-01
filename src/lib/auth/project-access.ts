import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner, type UserWithRole } from './rbac'

/**
 * オーナー以外のユーザーがアクセス可能なプロジェクトIDリストを取得する。
 * オーナーの場合は null を返す（= 全プロジェクトアクセス可）。
 *
 * @returns { user, allowedProjectIds, staffId }
 *   - user: 認証ユーザー（null の場合は未認証）
 *   - allowedProjectIds: アクセス可能なプロジェクトID配列。null = 制限なし（オーナー）
 *   - staffId: ユーザーに紐づくスタッフID（存在しない場合は null）
 */
export async function getProjectAccess(): Promise<{
  user: UserWithRole | null
  allowedProjectIds: string[] | null
  staffId: string | null
}> {
  const user = await getCurrentUser()
  if (!user) {
    return { user: null, allowedProjectIds: [], staffId: null }
  }

  // オーナーは全プロジェクトにアクセス可
  if (isOwner(user)) {
    return { user, allowedProjectIds: null, staffId: user.staffId }
  }

  // 管理者・メンバー: アサインされたプロジェクトのみ
  if (!user.staffId) {
    return { user, allowedProjectIds: [], staffId: null }
  }

  const supabase = await createServerSupabaseClient()
  const { data: myAssignments } = await supabase
    .from('project_assignments')
    .select('project_id')
    .eq('staff_id', user.staffId)

  const allowedProjectIds = (myAssignments || []).map((a) => a.project_id)
  return { user, allowedProjectIds, staffId: user.staffId }
}

/**
 * 特定プロジェクトへのアクセス権があるか確認する
 */
export async function canAccessProject(projectId: string): Promise<{
  user: UserWithRole | null
  hasAccess: boolean
  staffId: string | null
}> {
  const { user, allowedProjectIds, staffId } = await getProjectAccess()
  if (!user) {
    return { user: null, hasAccess: false, staffId: null }
  }

  // null = 制限なし（オーナー）
  if (allowedProjectIds === null) {
    return { user, hasAccess: true, staffId }
  }

  return { user, hasAccess: allowedProjectIds.includes(projectId), staffId }
}
