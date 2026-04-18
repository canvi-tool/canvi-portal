'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NAV_SECTIONS, APP_NAME, type NavItem } from '@/lib/constants'
import { canAccessRoute, isPlatformOwnerOnlyPath, isPlatformOwnerEmail, type Role } from '@/lib/auth/roles'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  LayoutGrid,
  KeyRound,
  UserPlus,
  UserCheck,
  Monitor,
  Users,
  FileText,
  Briefcase,
  FileStack,
  CalendarDays,
  Calendar,
  ClipboardList,
  BarChart3,
  Wallet,
  Bell,
  Settings,
  Building2,
  Receipt,
  Menu,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Clock,
  Palmtree,
  History,
  type LucideIcon,
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  LayoutGrid,
  KeyRound,
  UserPlus,
  UserCheck,
  Monitor,
  Users,
  FileText,
  Briefcase,
  FileStack,
  CalendarDays,
  Calendar,
  Clock,
  ClipboardList,
  BarChart3,
  Wallet,
  Bell,
  Settings,
  Building2,
  Receipt,
  Palmtree,
  History,
}

export interface SidebarProps {
  user?: { displayName: string; email: string; avatarUrl?: string; role?: Role; roleLabelJa?: string; canSwitchRole?: boolean; isImpersonating?: boolean } | null
  onSignOut?: () => void
}

interface ImpersonateUser {
  id: string
  email: string
  displayName: string
  role: string
}

function ImpersonateBlock({ user, collapsed, onSignOut }: { user: NonNullable<SidebarProps['user']>; collapsed: boolean; onSignOut?: () => void }) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<ImpersonateUser[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [realId, setRealId] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || users.length > 0) return
    setLoading(true)
    fetch('/api/dev/impersonate')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.users)) setUsers(data.users)
        if (data.realId) setRealId(data.realId)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, users.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const handleSwitch = async (userId: string) => {
    await fetch('/api/dev/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    window.location.reload()
  }

  const filtered = users.filter((u) => {
    if (!query) return true
    const q = query.toLowerCase()
    return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 w-full min-w-0 rounded-md px-1 py-1 hover:bg-white/10 transition text-left',
          collapsed && 'justify-center'
        )}
        title="アカウント切替（開発者のみ）"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-white">
          {user.displayName.charAt(0).toUpperCase()}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="truncate text-[13px] font-medium text-white flex items-center gap-1">
              {user.displayName}
              {user.isImpersonating && <span className="text-[9px] px-1 rounded bg-purple-500/30 text-purple-200">代理</span>}
            </p>
            <p className="truncate text-[11px] text-slate-400">{user.email}</p>
          </div>
        )}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 rounded-md border bg-popover text-popover-foreground shadow-lg p-2 z-50">
          <div className="px-1 pb-2 text-[11px] text-muted-foreground">
            開発者モード - アカウント切替
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名前・メールで検索"
            className="w-full mb-2 rounded border px-2 py-1 text-xs bg-background"
          />
          {user.isImpersonating && realId && (
            <button
              onClick={() => handleSwitch(realId)}
              className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted mb-1 border border-purple-300 bg-purple-50"
            >
              ← 自分のアカウントに戻る
            </button>
          )}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="text-xs text-muted-foreground px-2 py-4 text-center">読込中...</div>
            ) : filtered.length === 0 ? (
              <div className="text-xs text-muted-foreground px-2 py-4 text-center">該当なし</div>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSwitch(u.id)}
                  className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted flex items-center gap-2"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-medium">
                    {u.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{u.displayName}</div>
                    <div className="truncate text-muted-foreground text-[10px]">{u.email}</div>
                  </div>
                  <span className="text-[9px] text-muted-foreground shrink-0">{u.role}</span>
                </button>
              ))
            )}
          </div>
          <div className="border-t mt-2 pt-2">
            <button
              onClick={onSignOut}
              className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted text-red-600 flex items-center gap-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              ログアウト
            </button>
          </div>
        </div>
      )}
    </div>
  )
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
        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
        'hover:bg-white/10',
        isActive
          ? 'bg-indigo-600 text-white'
          : 'text-slate-300 hover:text-white',
        collapsed && 'justify-center px-2'
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
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
      <div className={cn('flex h-14 items-center border-b border-slate-700 px-4', collapsed && 'justify-center px-2')}>
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onNavigate}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white text-sm">
            C
          </div>
          {!collapsed && (
            <span className="text-base font-bold text-white">{APP_NAME}</span>
          )}
        </Link>
      </div>

      {/* Role badge */}
      {user?.roleLabelJa && !collapsed && (
        <div className="px-4 pb-1">
          {user.canSwitchRole ? (
            <button
              onClick={() => {
                const order: Role[] = ['owner', 'admin', 'staff']
                const next = order[(order.indexOf((user.role || 'owner') as Role) + 1) % order.length]
                document.cookie = `dev_role_override=${next};path=/;max-age=${60 * 60 * 24 * 30}`
                window.location.reload()
              }}
              title="クリックでロール切替（開発者のみ）"
              className={cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80 transition',
                user.role === 'owner' && 'bg-amber-500/20 text-amber-300',
                user.role === 'admin' && 'bg-blue-500/20 text-blue-300',
                user.role === 'staff' && 'bg-emerald-500/20 text-emerald-300',
              )}
            >
              {user.roleLabelJa} ⇄
            </button>
          ) : (
            <span className={cn(
              'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
              user.role === 'owner' && 'bg-amber-500/20 text-amber-300',
              user.role === 'admin' && 'bg-blue-500/20 text-blue-300',
              user.role === 'staff' && 'bg-emerald-500/20 text-emerald-300',
            )}>
              {user.roleLabelJa}
            </span>
          )}
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2.5 py-3">
        <nav className="flex flex-col gap-3">
          {NAV_SECTIONS.map((section) => {
            const isPlatformOwner = isPlatformOwnerEmail(user?.email)
            const visibleItems = section.items.filter((item) => {
              if (!user?.role) return false
              // プラットフォーム管理者専用パスは岡林のみ表示
              if (isPlatformOwnerOnlyPath(item.href)) return isPlatformOwner
              return canAccessRoute(user.role, item.href)
            })
            if (visibleItems.length === 0) return null
            return (
              <div key={section.title}>
                {!collapsed && (
                  <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {section.title}
                  </p>
                )}
                {collapsed && <Separator className="bg-slate-700 mb-1" />}
                <div className="flex flex-col gap-0.5">
                  {visibleItems.map((item) => (
                    <div key={item.href} onClick={onNavigate}>
                      <NavLink
                        item={item}
                        isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                        collapsed={collapsed}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Collapse toggle (desktop only) */}
      {onCollapse && (
        <>
          <Separator className="bg-slate-700" />
          <div className="px-2 py-1.5">
            <button
              onClick={() => onCollapse(!collapsed)}
              className="flex w-full items-center justify-center rounded-md px-2 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-1.5" />
                  <span>折りたたむ</span>
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* User info + logout */}
      <Separator className="bg-slate-700" />
      <div className={cn('p-2', collapsed && 'flex justify-center')}>
        {user ? (
          user.canSwitchRole ? (
            <ImpersonateBlock user={user} collapsed={collapsed} onSignOut={onSignOut} />
          ) : (
          <div className={cn('flex items-center gap-2', collapsed && 'flex-col')}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-white">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-[13px] font-medium text-white">
                  {user.displayName}
                </p>
                <p className="truncate text-[11px] text-slate-400">{user.email}</p>
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
          )
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
        collapsed ? 'lg:w-14' : 'lg:w-56'
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
