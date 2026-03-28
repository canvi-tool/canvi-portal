'use client'

import { DesktopSidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { useAuth } from '@/components/providers/auth-provider'
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
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
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
