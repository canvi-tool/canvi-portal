export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PortalShell } from './portal-shell'
import { ROLE_LABELS, type Role } from '@/lib/auth/roles'

const DEV_EMAILS = ['yuji.okabayashi@canvi.co.jp', 'okabayashi@canvi.co.jp', 'yui.goto@canvi.co.jp']

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user = null
  let supabase = null as Awaited<ReturnType<typeof createServerSupabaseClient>> | null
  try {
    supabase = await createServerSupabaseClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Supabase not configured or unreachable
  }

  if (!user) {
    redirect('/login')
  }

  // ユーザーのロールをDBから取得
  let roleName: Role = 'staff'
  let roleLabelJa = 'メンバー'
  if (supabase) {
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', user.id)

    const roleNames = (userRoles ?? [])
      .map((ur: { roles: { name: string } | null }) => ur.roles?.name)
      .filter(Boolean) as string[]

    if (roleNames.includes('owner')) {
      roleName = 'owner'
      roleLabelJa = 'オーナー'
    } else if (roleNames.includes('admin')) {
      roleName = 'admin'
      roleLabelJa = '管理者'
    }
    // default: staff/メンバー
  }

  // 開発者のロール切替（dev_role_override クッキー）
  const cookieStore = await cookies()
  const devOverride = cookieStore.get('dev_role_override')?.value as Role | undefined
  const canSwitchRole = !!user.email && DEV_EMAILS.includes(user.email)
  if (canSwitchRole && devOverride && ['owner', 'admin', 'staff'].includes(devOverride)) {
    roleName = devOverride
    roleLabelJa = ROLE_LABELS[devOverride]
  }

  // display_nameをusersテーブルから取得（staffの氏名が入っている）
  let displayName = user.user_metadata?.full_name || user.email || ''
  if (supabase) {
    const { data: userData } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', user.id)
      .single()
    if (userData?.display_name && !userData.display_name.includes('@')) {
      displayName = userData.display_name
    }
  }

  let email = user.email || ''
  const avatarUrl = user.user_metadata?.avatar_url || undefined

  // 開発者インパーソネーション: dev_user_override cookieで他メンバーに切替
  let impersonatedUserId: string | null = null
  if (canSwitchRole) {
    const impersonateId = cookieStore.get('dev_user_override')?.value
    if (impersonateId && impersonateId !== user.id) {
      try {
        const adminClient = createAdminClient()
        const { data: targetUser } = await adminClient
          .from('users')
          .select(`
            id, email, display_name,
            user_roles!user_roles_user_id_fkey(role:roles(name))
          `)
          .eq('id', impersonateId)
          .single()

        if (targetUser) {
          impersonatedUserId = targetUser.id
          displayName = targetUser.display_name || targetUser.email || displayName
          email = targetUser.email || email
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const targetRoleNames = ((targetUser.user_roles as any[]) || [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((ur: any) => ur.role?.name as string)
            .filter(Boolean) as string[]
          if (targetRoleNames.includes('owner')) { roleName = 'owner'; roleLabelJa = 'オーナー' }
          else if (targetRoleNames.includes('admin')) { roleName = 'admin'; roleLabelJa = '管理者' }
          else { roleName = 'staff'; roleLabelJa = 'メンバー' }
        }
      } catch (e) {
        console.error('impersonation lookup failed:', e)
      }
    }
  }

  return (
    <PortalShell
      user={{ displayName, email, avatarUrl, role: roleName, roleLabelJa, canSwitchRole, isImpersonating: !!impersonatedUserId }}
    >
      {children}
    </PortalShell>
  )
}
