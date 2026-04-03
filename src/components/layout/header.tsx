'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { MobileSidebar, type SidebarProps } from '@/components/layout/sidebar'
import { Bell, Settings, User, LogOut } from 'lucide-react'
import { ClockWidgetCompact } from '@/components/shared/clock-widget'

interface HeaderProps {
  user?: SidebarProps['user'] & { avatarUrl?: string }
  onSignOut?: () => void
  notificationCount?: number
}

export function Header({ user, onSignOut, notificationCount = 0 }: HeaderProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials = user?.displayName
    ? user.displayName
        .split(/\s+/)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleLogout = () => {
    setOpen(false)
    if (onSignOut) {
      onSignOut()
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 sm:px-5">
      {/* Mobile menu trigger */}
      <MobileSidebar user={user} onSignOut={onSignOut} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clock Widget */}
      <ClockWidgetCompact />

      {/* Notifications */}
      <Link
        href="/alerts"
        className="relative inline-flex items-center justify-center rounded-md size-8 hover:bg-muted transition-colors"
      >
        <Bell className="h-4 w-4" />
        {notificationCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        )}
        <span className="sr-only">通知</span>
      </Link>

      {/* User dropdown - plain implementation */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-muted outline-none"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {initials}
          </div>
          <span className="hidden text-sm font-medium sm:inline-block">
            {user?.displayName ?? 'ゲスト'}
          </span>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md z-50">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.displayName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <User className="h-4 w-4" />
              プロフィール
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <Settings className="h-4 w-4" />
              設定
            </Link>
            <div className="my-1 h-px bg-border" />
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              ログアウト
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
