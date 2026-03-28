'use client'

import { useRouter } from 'next/navigation'
import { DesktopSidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { useAuth } from '@/components/providers/auth-provider'

interface PortalShellProps {
  user: { displayName: string; email: string; avatarUrl?: string }
  children: React.ReactNode
}

export function PortalShell({ user, children }: PortalShellProps) {
  const router = useRouter()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <DesktopSidebar user={user} onSignOut={handleSignOut} />

      {/* Main content area - offset by sidebar width on desktop */}
      <div className="lg:pl-64">
        <Header user={user} onSignOut={handleSignOut} />

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
