import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type RoleName = 'owner' | 'admin' | 'staff'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

/** オーナーメールアドレス（初回自動セットアップ用） */
const OWNER_EMAILS = ['yuji.okabayashi@canvi.co.jp', 'okabayashi@canvi.co.jp']

const DEMO_USERS: Record<string, UserWithRole> = {
  owner: {
    id: 'demo-owner-001',
    email: 'okabayashi@canvi.co.jp',
    displayName: '岡林 優治',
    roles: ['owner'],
    staffId: null,
  },
  admin: {
    id: 'demo-admin-001',
    email: 'tanaka@canvi.co.jp',
    displayName: '田中 美咲',
    roles: ['admin'],
    staffId: null,
  },
  staff: {
    id: 'demo-staff-001',
    email: 'sato@example.com',
    displayName: '佐藤 健太',
    roles: ['staff'],
    staffId: null,
  },
}

export interface UserWithRole {
  id: string
  email: string
  displayName: string
  roles: RoleName[]
  staffId: string | null
}

export async function getCurrentUser(): Promise<UserWithRole | null> {
  if (DEMO_MODE) {
    const cookieStore = await cookies()
    const demoRole = cookieStore.get('demo_role')?.value
    if (demoRole && DEMO_USERS[demoRole]) {
      return DEMO_USERS[demoRole]
    }
    return DEMO_USERS.owner
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.log('getCurrentUser: no auth user')
    return null
  }

  // eslint-disable-next-line prefer-const
  let { data: userData, error: userError } = await supabase
    .from('users')
    .select(
      `
      id, email, display_name,
      user_roles!user_roles_user_id_fkey(role:roles(name))
    `
    )
    .eq('id', user.id)
    .single()

  console.log('getCurrentUser:', user.email, 'userData:', userData ? 'found' : 'null', 'error:', userError?.message || 'none')

  // Auto-provision: auth user exists but no users table record
  if (!userData) {
    const adminClient = createAdminClient()
    const email = user.email || ''
    const displayName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      email.split('@')[0] || ''

    // Create users record
    const { error: insertError } = await adminClient.from('users').upsert(
      {
        id: user.id,
        email,
        display_name: displayName,
      },
      { onConflict: 'id' }
    )

    if (insertError) {
      console.error('Auto-provision users record failed:', insertError)
      return null
    }

    // Determine role: owner emails get owner, first user gets owner, others get staff
    let roleName: RoleName = 'staff'
    if (OWNER_EMAILS.includes(email.toLowerCase())) {
      roleName = 'owner'
    } else {
      // Check if this is the very first user
      const { count } = await adminClient
        .from('users')
        .select('id', { count: 'exact', head: true })
      if (count !== null && count <= 1) {
        roleName = 'owner'
      }
    }

    // Get or create role
    const { data: roleData } = await adminClient
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .single()

    if (roleData) {
      await adminClient.from('user_roles').upsert(
        { user_id: user.id, role_id: roleData.id },
        { onConflict: 'user_id,role_id' }
      )
    }

    console.log(`Auto-provisioned user ${email} with role ${roleName}`)

    // Re-fetch with roles (adminClientでRLSをバイパス)
    const { data: refetched } = await adminClient
      .from('users')
      .select(
        `
        id, email, display_name,
        user_roles!user_roles_user_id_fkey(role:roles(name))
      `
      )
      .eq('id', user.id)
      .single()

    userData = refetched
  }

  if (!userData) return null

  // rolesが空の場合、オーナーメールなら自動修復
  let roles =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (userData.user_roles as any[])?.map((ur: any) => ur.role?.name as RoleName) || []

  if (roles.length === 0 && OWNER_EMAILS.includes((user.email || '').toLowerCase())) {
    // ロール未割当のオーナー → 自動修復
    const adminClient = createAdminClient()
    const { data: ownerRole } = await adminClient
      .from('roles')
      .select('id')
      .eq('name', 'owner')
      .single()

    if (ownerRole) {
      await adminClient.from('user_roles').upsert(
        { user_id: user.id, role_id: ownerRole.id },
        { onConflict: 'user_id,role_id' }
      )
      roles = ['owner']
      console.log(`Auto-repaired owner role for ${user.email}`)
    }
  }

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

export function isManagerOrOwner(user: UserWithRole): boolean {
  return hasRole(user, 'owner') || hasRole(user, 'admin')
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

/**
 * マイナンバー担当者権限チェック
 * user_permissionsテーブルでmy_number/readが付与されているか確認
 * ownerは全権限を持つため常にtrue
 */
export async function hasMyNumberAccess(user: UserWithRole): Promise<boolean> {
  if (isOwner(user)) return true

  try {
    const adminClient = createAdminClient()

    // my_number/read権限IDを取得
    const { data: perm } = await adminClient
      .from('permissions')
      .select('id')
      .eq('resource', 'my_number')
      .eq('action', 'read')
      .single()

    if (!perm) return false

    // user_permissionsテーブル（型未定義のためas neverでバイパス）
    const { data, error } = await adminClient
      .from('user_permissions' as never)
      .select('user_id' as never)
      .eq('user_id' as never, user.id)
      .eq('permission_id' as never, perm.id) as { data: unknown[] | null; error: unknown }

    if (error || !data) return false
    return data.length > 0
  } catch {
    return false
  }
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
