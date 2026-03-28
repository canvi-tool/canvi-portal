export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PortalShell } from './portal-shell'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // デモモード: 仮ユーザーで表示
  if (DEMO_MODE) {
    return (
      <PortalShell
        user={{
          displayName: 'デモユーザー',
          email: 'demo@canvi.jp',
          avatarUrl: undefined,
        }}
      >
        {children}
      </PortalShell>
    )
  }

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
