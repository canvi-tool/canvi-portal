export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PortalShell } from './portal-shell'
import { getDemoAccountByRole, type DemoRole } from '@/lib/demo-accounts'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // デモモード
  if (DEMO_MODE) {
    const cookieStore = await cookies()
    const demoRole = cookieStore.get('demo_role')?.value as DemoRole | undefined

    if (!demoRole) {
      redirect('/login')
    }

    const account = getDemoAccountByRole(demoRole)
    return (
      <PortalShell
        user={{
          displayName: account.name,
          email: account.email,
          avatarUrl: undefined,
          role: account.role,
          roleLabelJa: account.roleLabelJa,
        }}
      >
        {children}
      </PortalShell>
    )
  }

  // 本番モード
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
  let roleName: DemoRole = 'staff'
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

  const email = user.email || ''
  const avatarUrl = user.user_metadata?.avatar_url || undefined

  return (
    <PortalShell
      user={{ displayName, email, avatarUrl, role: roleName, roleLabelJa }}
    >
      {children}
    </PortalShell>
  )
}
