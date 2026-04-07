import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner, isAdmin, hasRole, getStaffUserRole, type UserWithRole } from './rbac'

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
    .is('deleted_at', null)

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

/**
 * 特定プロジェクトのシフトを管理（承認・編集・削除）できるか確認する。
 * - オーナー: 全プロジェクト管理可能
 * - 管理者(admin): アサインされているプロジェクトのみ管理可能
 * - スタッフ: 管理権限なし
 */
export async function canManageProjectShifts(projectId: string): Promise<{
  user: UserWithRole | null
  canManage: boolean
}> {
  const user = await getCurrentUser()
  if (!user) {
    return { user: null, canManage: false }
  }

  // オーナーは全プロジェクト管理可能
  if (isOwner(user)) {
    return { user, canManage: true }
  }

  // 管理者のみ管理権限あり（スタッフは不可）
  if (!hasRole(user, 'admin')) {
    return { user, canManage: false }
  }

  // 管理者: アサインされているプロジェクトのみ
  if (!user.staffId) {
    return { user, canManage: false }
  }

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('project_assignments')
    .select('id')
    .eq('staff_id', user.staffId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .limit(1)

  return { user, canManage: (data && data.length > 0) || false }
}

/**
 * カレンダー/シフト権限ポリシー
 *
 * 前提: 自分のカレンダー（自分が staff_id のシフト）は誰でも編集可能
 *
 * メンバー (staff):
 *   - 閲覧: 自身のPJの全員のシフト
 *   - 編集: 自分のシフトのみ
 * 管理者 (admin):
 *   - 閲覧・編集: 自身のPJの全員のシフト
 * オーナー (owner):
 *   - 閲覧・編集: 全員
 */

/**
 * 特定シフトを閲覧できるかを判定する
 */
export async function canViewShift(shift: {
  staff_id?: string | null
  project_id?: string | null
}): Promise<{ user: UserWithRole | null; canView: boolean }> {
  const { user, allowedProjectIds, staffId } = await getProjectAccess()
  if (!user) return { user: null, canView: false }

  // オーナー: 全閲覧可
  if (allowedProjectIds === null) return { user, canView: true }

  // 自分のシフトは常に閲覧可
  if (staffId && shift.staff_id === staffId) return { user, canView: true }

  // 自身のPJに属するシフトは閲覧可
  if (shift.project_id && allowedProjectIds.includes(shift.project_id)) {
    return { user, canView: true }
  }

  return { user, canView: false }
}

/**
 * 特定シフトを編集（更新・削除）できるかを判定する
 */
export async function canEditShift(shift: {
  staff_id?: string | null
  project_id?: string | null
}): Promise<{ user: UserWithRole | null; canEdit: boolean }> {
  const { user, allowedProjectIds, staffId } = await getProjectAccess()
  if (!user) return { user: null, canEdit: false }

  // オーナー: 全編集可
  if (isOwner(user)) return { user, canEdit: true }

  // 自分のシフトは常に編集可
  if (staffId && shift.staff_id === staffId) return { user, canEdit: true }

  // 管理者: 自身のPJ内のシフトは編集可。ただしオーナーロールのユーザーのシフトは編集不可
  if (isAdmin(user) && shift.project_id && allowedProjectIds?.includes(shift.project_id)) {
    if (shift.staff_id) {
      const targetRole = await getStaffUserRole(shift.staff_id)
      if (targetRole === 'owner') {
        return { user, canEdit: false }
      }
    }
    return { user, canEdit: true }
  }

  // メンバー: 他人のシフトは編集不可
  return { user, canEdit: false }
}
