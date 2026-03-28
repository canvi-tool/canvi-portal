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
  try {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Supabase not configured or unreachable
  }

  if (!user) {
    redirect('/login')
  }

  const displayName =
    user.user_metadata?.full_name || user.email || ''
  const email = user.email || ''
  const avatarUrl = user.user_metadata?.avatar_url || undefined

  return (
    <PortalShell
      user={{ displayName, email, avatarUrl }}
    >
      {children}
    </PortalShell>
  )
}
