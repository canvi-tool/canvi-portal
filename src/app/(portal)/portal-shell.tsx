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
  const handleSignOut = async () => {
    try {
      // デモモードのクッキー削除
      document.cookie = 'demo_role=;path=/;max-age=0'
      // Supabase セッション削除
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch (err) {
      console.error('ログアウトエラー:', err)
    }
    // 必ずリダイレクト
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <DesktopSidebar user={user} onSignOut={handleSignOut} />

      {/* Main content area - offset by sidebar width on desktop */}
      <div className="lg:pl-64 min-w-0">
        <Header user={user} onSignOut={handleSignOut} />

        <main className="p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  )
}
