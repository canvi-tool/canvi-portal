'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, APP_NAME, type NavItem } from '@/lib/constants'
import { canAccessRoute, type DemoRole } from '@/lib/demo-accounts'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  Users,
  FileText,
  Briefcase,
  FileStack,
  CalendarDays,
  ClipboardList,
  BarChart3,
  Wallet,
  UserMinus,
  Brain,
  Sparkles,
  Bell,
  Settings,
  KeyRound,
  Menu,
  LogOut,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  FileText,
  Briefcase,
  FileStack,
  CalendarDays,
  ClipboardList,
  BarChart3,
  Wallet,
  UserMinus,
  Brain,
  Sparkles,
  Bell,
  Settings,
  KeyRound,
}

export interface SidebarProps {
  user?: { displayName: string; email: string; avatarUrl?: string; role?: DemoRole; roleLabelJa?: string } | null
  onSignOut?: () => void
}

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
}) {
  const Icon = iconMap[item.icon] || LayoutDashboard

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        'hover:bg-white/10',
        isActive
          ? 'bg-indigo-600 text-white'
          : 'text-slate-300 hover:text-white',
        collapsed && 'justify-center px-2'
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
}

function SidebarContent({
  collapsed,
  onCollapse,
  user,
  onSignOut,
  onNavigate,
}: {
  collapsed: boolean
  onCollapse?: (collapsed: boolean) => void
  user?: SidebarProps['user']
  onSignOut?: () => void
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col bg-slate-900">
      {/* Logo */}
      <div className={cn('flex h-16 items-center border-b border-slate-700 px-4', collapsed && 'justify-center px-2')}>
        <Link href="/dashboard" className="flex items-center gap-2" onClick={onNavigate}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white text-sm">
            C
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-white">{APP_NAME}</span>
          )}
        </Link>
      </div>

      {/* Role badge */}
      {user?.roleLabelJa && !collapsed && (
        <div className="px-4 pb-1">
          <span className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
            user.role === 'owner' && 'bg-amber-500/20 text-amber-300',
            user.role === 'admin' && 'bg-blue-500/20 text-blue-300',
            user.role === 'staff' && 'bg-emerald-500/20 text-emerald-300',
          )}>
            {user.roleLabelJa}
          </span>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS
            .filter((item) => !user?.role || canAccessRoute(user.role, item.href))
            .map((item) => (
            <div key={item.href} onClick={onNavigate}>
              <NavLink
                item={item}
                isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                collapsed={collapsed}
              />
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Collapse toggle (desktop only) */}
      {onCollapse && (
        <>
          <Separator className="bg-slate-700" />
          <div className="px-3 py-2">
            <button
              onClick={() => onCollapse(!collapsed)}
              className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <>
                  <ChevronLeft className="h-5 w-5 mr-2" />
                  <span>折りたたむ</span>
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* User info + logout */}
      <Separator className="bg-slate-700" />
      <div className={cn('p-3', collapsed && 'flex justify-center')}>
        {user ? (
          <div className={cn('flex items-center gap-3', collapsed && 'flex-col')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-medium text-white">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {user.displayName}
                </p>
                <p className="truncate text-xs text-slate-400">{user.email}</p>
              </div>
            )}
            <button
              onClick={onSignOut}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              title="ログアウト"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="h-8" />
        )}
      </div>
    </div>
  )
}

/** Desktop sidebar (fixed left) */
export function DesktopSidebar({ user, onSignOut }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:flex-col transition-all duration-300',
        collapsed ? 'lg:w-16' : 'lg:w-64'
      )}
    >
      <SidebarContent
        collapsed={collapsed}
        onCollapse={setCollapsed}
        user={user}
        onSignOut={onSignOut}
      />
    </aside>
  )
}

/** Mobile sidebar (Sheet) */
export function MobileSidebar({ user, onSignOut }: SidebarProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button className="inline-flex items-center justify-center rounded-lg size-8 hover:bg-muted hover:text-foreground lg:hidden" />
        }
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">メニューを開く</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 bg-slate-900 border-slate-700" showCloseButton={false}>
        <SheetTitle className="sr-only">ナビゲーション</SheetTitle>
        <SidebarContent
          collapsed={false}
          user={user}
          onSignOut={onSignOut}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  )
}

export { SidebarContent }
