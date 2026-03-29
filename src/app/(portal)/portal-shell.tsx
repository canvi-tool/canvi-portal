'use client'

import { DesktopSidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { createClient } from '@/lib/supabase/client'
import type { DemoRole } from '@/lib/demo-accounts'

interface PortalShellProps {
  user: {
    displayName: string
    email: string
    avatarUrl?: string
    role?: DemoRole
    roleLabelJa?: string
  }
  children: React.ReactNode
}

export function PortalShell({ user, children }: PortalShellProps) {
  const handleSignOut = () => {
    // クッキー削除
    document.cookie = 'demo_role=;path=/;max-age=0'
    // Supabase セッション削除（awaitしない - ハングを防ぐ）
    try {
      const supabase = createClient()
      supabase.auth.signOut().catch(() => {})
    } catch {}
    // 即座にリダイレクト
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <DesktopSidebar user={user} onSignOut={handleSignOut} />

      {/* Main content area - offset by sidebar width on desktop */}
      <div className="lg:pl-56 min-w-0">
        <Header user={user} onSignOut={handleSignOut} />

        <main className="p-3 sm:p-4 lg:p-6 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  )
}
