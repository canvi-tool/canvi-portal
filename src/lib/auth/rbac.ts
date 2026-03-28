import { createServerSupabaseClient } from '@/lib/supabase/server'

export type RoleName = 'owner' | 'admin' | 'staff'

export interface UserWithRole {
  id: string
  email: string
  displayName: string
  roles: RoleName[]
  staffId: string | null
}

export async function getCurrentUser(): Promise<UserWithRole | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: userData } = await supabase
    .from('users')
    .select(
      `
      id, email, display_name,
      user_roles(role:roles(name))
    `
    )
    .eq('id', user.id)
    .single()

  if (!userData) return null

  const roles =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (userData.user_roles as any[])?.map((ur: any) => ur.role?.name as RoleName) || []

  // Get staff_id if exists
  const { data: staffData } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    id: userData.id,
    email: userData.email,
    displayName: userData.display_name,
    roles,
    staffId: staffData?.id || null,
  }
}

export function hasRole(user: UserWithRole, role: RoleName): boolean {
  return user.roles.includes(role)
}

export function isOwner(user: UserWithRole): boolean {
  return hasRole(user, 'owner')
}

export function isAdmin(user: UserWithRole): boolean {
  return hasRole(user, 'admin') || hasRole(user, 'owner')
}

export function isStaff(user: UserWithRole): boolean {
  return hasRole(user, 'staff')
}

export async function checkPermission(
  resource: string,
  action: string
): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  if (isOwner(user)) return true // Owner has all permissions

  const supabase = await createServerSupabaseClient()

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', user.id)

  const roleIds = userRoles?.map((r) => r.role_id) || []
  if (roleIds.length === 0) return false

  const { data } = await supabase
    .from('role_permissions')
    .select('permission:permissions(resource, action)')
    .in('role_id', roleIds)

  return (
    /* eslint-disable @typescript-eslint/no-explicit-any */
    (data as any[])?.some(
      (rp: any) =>
        rp.permission?.resource === resource && rp.permission?.action === action
    ) || false
    /* eslint-enable @typescript-eslint/no-explicit-any */
  )
}

export async function requireRole(role: RoleName): Promise<UserWithRole> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  if (!hasRole(user, role) && !isOwner(user)) throw new Error('Forbidden')
  return user
}

export async function requireAdmin(): Promise<UserWithRole> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  if (!isAdmin(user)) throw new Error('Forbidden')
  return user
}
