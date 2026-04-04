'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Loader2,
  Crown,
  Shield,
  User,
  UserCog,
  UserPlus,
  Trash2,
  CheckSquare,
  ArrowRightLeft,
  KeyRound,
  Copy,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

interface UserWithRoles {
  id: string
  displayName: string
  email: string
  roles: string[]
}

interface RoleOption {
  id: string
  name: string
}

interface RoleTab {
  key: string
  label: string
  description: string
  icon: LucideIcon
  color: string
  badgeVariant: 'default' | 'secondary' | 'outline'
}

const ROLE_TABS: RoleTab[] = [
  {
    key: 'owner',
    label: 'オーナー',
    description: 'システム全権限を持つオーナー（役員）',
    icon: Crown,
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    badgeVariant: 'default',
  },
  {
    key: 'admin',
    label: '管理者',
    description: '日常運用を行う管理者',
    icon: Shield,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    badgeVariant: 'secondary',
  },
  {
    key: 'staff',
    label: 'スタッフ',
    description: '自身の情報を閲覧するスタッフ',
    icon: User,
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    badgeVariant: 'outline',
  },
  {
    key: 'none',
    label: '未割当',
    description: 'ロールが割り当てられていないユーザー',
    icon: UserCog,
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    badgeVariant: 'outline',
  },
]

export default function UserRolesPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('owner')

  // Selection
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // Single assign dialog (add user to a role tab)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignRoleKey, setAssignRoleKey] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Role change dialog (change a user's role from current tab to another)
  const [changeTarget, setChangeTarget] = useState<UserWithRoles | null>(null)
  const [changeToRoleKey, setChangeToRoleKey] = useState('')
  const [changingRole, setChangingRole] = useState(false)

  // Bulk assign dialog
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [bulkAssignRoleKey, setBulkAssignRoleKey] = useState('')

  // Remove dialog
  const [removeTarget, setRemoveTarget] = useState<{
    user: UserWithRoles
    roleName: string
    roleId: string
  } | null>(null)
  const [removingRole, setRemovingRole] = useState(false)

  // Bulk remove
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false)

  // Password reset
  const [resetTarget, setResetTarget] = useState<UserWithRoles | null>(null)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [resetResult, setResetResult] = useState<{ userName: string; password: string } | null>(null)
  const [copiedResetPw, setCopiedResetPw] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/roles')
      if (res.status === 403) {
        router.push('/dashboard')
        return
      }
      if (!res.ok) throw new Error('データの取得に失敗しました')

      const data = await res.json()

      const roleOptions: RoleOption[] = (data.roles || []).map(
        (r: { id: string; name: string }) => ({ id: r.id, name: r.name })
      )
      setRoles(roleOptions)

      const userMap = new Map<string, UserWithRoles>()
      for (const u of data.allUsers || []) {
        userMap.set(u.id, { id: u.id, displayName: u.display_name, email: u.email, roles: [] })
      }
      for (const role of data.roles || []) {
        for (const u of role.users || []) {
          const existing = userMap.get(u.id)
          if (existing) {
            existing.roles.push(role.name)
          } else {
            userMap.set(u.id, { id: u.id, displayName: u.display_name, email: u.email, roles: [role.name] })
          }
        }
      }
      setUsers(Array.from(userMap.values()).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'ja')))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setSelectedUserIds(new Set()) }, [activeTab])

  const getUsersForTab = useCallback((tabKey: string) => {
    if (tabKey === 'none') return users.filter((u) => u.roles.length === 0)
    return users.filter((u) => u.roles.includes(tabKey))
  }, [users])

  const getAvailableUsersForRole = (roleKey: string) => users.filter((u) => !u.roles.includes(roleKey))

  const currentTabUsers = useMemo(() => getUsersForTab(activeTab), [getUsersForTab, activeTab])

  const isAllSelected = currentTabUsers.length > 0 && currentTabUsers.every((u) => selectedUserIds.has(u.id))

  const toggleSelectAll = () => {
    setSelectedUserIds(isAllSelected ? new Set() : new Set(currentTabUsers.map((u) => u.id)))
  }

  const toggleSelect = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  // Single assign (add to role)
  const handleAssignRole = async () => {
    if (!selectedUserId || !assignRoleKey) return
    const roleId = roles.find((r) => r.name === assignRoleKey)?.id
    if (!roleId) return
    setAssigning(true)
    try {
      const res = await fetch('/api/settings/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', user_id: selectedUserId, role_id: roleId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || '割り当てに失敗しました'); return }
      toast.success(`${users.find((u) => u.id === selectedUserId)?.displayName} に${ROLE_TABS.find((t) => t.key === assignRoleKey)?.label}ロールを割り当てました`)
      setAssignOpen(false); setSelectedUserId(''); setAssignRoleKey('')
      fetchData()
    } catch { toast.error('割り当てに失敗しました') } finally { setAssigning(false) }
  }

  // Role change: remove from current role + assign to new role
  const handleChangeRole = async () => {
    if (!changeTarget || !changeToRoleKey) return
    const newRoleId = roles.find((r) => r.name === changeToRoleKey)?.id
    if (!newRoleId) return

    setChangingRole(true)
    try {
      // Remove from current tab's role (if not "none")
      if (activeTab !== 'none') {
        const currentRoleId = roles.find((r) => r.name === activeTab)?.id
        if (currentRoleId) {
          const removeRes = await fetch('/api/settings/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'remove', user_id: changeTarget.id, role_id: currentRoleId }),
          })
          if (!removeRes.ok) {
            const d = await removeRes.json()
            toast.error(d.error || '現在のロール解除に失敗しました'); return
          }
        }
      }
      // Assign new role
      const assignRes = await fetch('/api/settings/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', user_id: changeTarget.id, role_id: newRoleId }),
      })
      const data = await assignRes.json()
      if (!assignRes.ok) { toast.error(data.error || '新しいロールの割り当てに失敗しました'); return }

      const fromLabel = ROLE_TABS.find((t) => t.key === activeTab)?.label || activeTab
      const toLabel = ROLE_TABS.find((t) => t.key === changeToRoleKey)?.label || changeToRoleKey
      toast.success(`${changeTarget.displayName} を ${fromLabel} → ${toLabel} に変更しました`)
      setChangeTarget(null); setChangeToRoleKey('')
      fetchData()
    } catch { toast.error('ロール変更に失敗しました') } finally { setChangingRole(false) }
  }

  // Bulk assign
  const handleBulkAssign = async () => {
    const targetRoleKey = bulkAssignRoleKey
    if (!targetRoleKey || selectedUserIds.size === 0) return
    const roleId = roles.find((r) => r.name === targetRoleKey)?.id
    if (!roleId) return
    setBulkProcessing(true)
    try {
      const res = await fetch('/api/settings/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_assign', user_ids: Array.from(selectedUserIds), role_id: roleId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || '一括割り当てに失敗しました'); return }
      toast.success(`${selectedUserIds.size}名に${ROLE_TABS.find((t) => t.key === targetRoleKey)?.label}ロールを一括割り当てしました`)
      setBulkAssignOpen(false); setBulkAssignRoleKey(''); setSelectedUserIds(new Set())
      fetchData()
    } catch { toast.error('一括割り当てに失敗しました') } finally { setBulkProcessing(false) }
  }

  // Single remove
  const handleRemoveRole = async () => {
    if (!removeTarget) return
    setRemovingRole(true)
    try {
      const res = await fetch('/api/settings/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', user_id: removeTarget.user.id, role_id: removeTarget.roleId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || '解除に失敗しました'); return }
      toast.success(`${removeTarget.user.displayName} の${ROLE_TABS.find((t) => t.key === removeTarget.roleName)?.label}ロールを解除しました`)
      setRemoveTarget(null); fetchData()
    } catch { toast.error('解除に失敗しました') } finally { setRemovingRole(false) }
  }

  // Bulk remove
  const handleBulkRemove = async () => {
    if (selectedUserIds.size === 0) return
    const roleId = roles.find((r) => r.name === activeTab)?.id
    if (!roleId) return
    setBulkProcessing(true)
    try {
      const res = await fetch('/api/settings/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_remove', user_ids: Array.from(selectedUserIds), role_id: roleId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || '一括解除に失敗しました'); return }
      toast.success(`${selectedUserIds.size}名の${ROLE_TABS.find((t) => t.key === activeTab)?.label}ロールを一括解除しました`)
      setBulkRemoveOpen(false); setSelectedUserIds(new Set()); fetchData()
    } catch { toast.error('一括解除に失敗しました') } finally { setBulkProcessing(false) }
  }

  // Password reset
  const handleResetPassword = async () => {
    if (!resetTarget) return
    setResettingPassword(true)
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: resetTarget.id }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'パスワードリセットに失敗しました'); return }
      setResetResult({ userName: resetTarget.displayName, password: data.new_password })
      setResetTarget(null)
      toast.success(`${resetTarget.displayName} のパスワードをリセットしました`)
    } catch { toast.error('パスワードリセットに失敗しました') } finally { setResettingPassword(false) }
  }

  const isNoneTab = activeTab === 'none'
  const hasSelection = selectedUserIds.size > 0

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="ユーザーロール管理" description="全ユーザーのロールを管理します" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="ユーザーロール管理" description="全ユーザーのロールを管理します" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ユーザーロール管理"
        description="全ポータルユーザーのロール（権限グループ）を一覧・変更します。オーナーのみ操作可能です。"
      />

      <Tabs defaultValue="owner" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          {ROLE_TABS.map((tab) => {
            const Icon = tab.icon
            const count = getUsersForTab(tab.key).length
            return (
              <TabsTrigger key={tab.key} value={tab.key}>
                <Icon className="h-4 w-4 mr-1.5" />
                {tab.label}
                <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-xs">{count}</Badge>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {ROLE_TABS.map((tab) => {
          const tabUsers = getUsersForTab(tab.key)
          const Icon = tab.icon
          const isThisNoneTab = tab.key === 'none'

          return (
            <TabsContent key={tab.key} value={tab.key}>
              <Card>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tab.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{tab.label}</h3>
                      <p className="text-xs text-muted-foreground">{tab.description}</p>
                    </div>
                  </div>
                  {!isThisNoneTab && (
                    <Button size="sm" onClick={() => { setAssignRoleKey(tab.key); setSelectedUserId(''); setAssignOpen(true) }}>
                      <UserPlus className="h-4 w-4 mr-1.5" />
                      追加
                    </Button>
                  )}
                </div>

                {/* Bulk action bar */}
                {hasSelection && activeTab === tab.key && (
                  <div className="flex items-center gap-3 px-6 py-3 bg-primary/5 border-b flex-wrap">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{selectedUserIds.size}名を選択中</span>
                    <div className="flex-1" />
                    {/* Bulk role change */}
                    <Button
                      size="sm"
                      onClick={() => { setBulkAssignRoleKey(''); setBulkAssignOpen(true) }}
                      disabled={bulkProcessing}
                    >
                      {bulkProcessing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                      一括ロール変更
                    </Button>
                    {/* Bulk remove (not on none tab) */}
                    {!isThisNoneTab && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setBulkRemoveOpen(true)}
                        disabled={bulkProcessing}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        一括解除
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setSelectedUserIds(new Set())}>
                      選択解除
                    </Button>
                  </div>
                )}

                <CardContent className="p-0">
                  {tabUsers.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Icon className="mx-auto h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">
                        {isThisNoneTab ? 'ロール未割当のユーザーはいません' : `${tab.label}ロールのユーザーはいません`}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {/* Select all */}
                      {tabUsers.length > 1 && (
                        <label className="flex items-center gap-3 px-6 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                          <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/50" />
                          <span className="text-xs font-medium text-muted-foreground">全て選択（{tabUsers.length}名）</span>
                        </label>
                      )}

                      {tabUsers.map((user) => (
                        <div key={user.id} className={`flex items-center gap-4 px-6 py-3 ${selectedUserIds.has(user.id) ? 'bg-primary/5' : ''}`}>
                          {/* Checkbox */}
                          <input type="checkbox" checked={selectedUserIds.has(user.id)} onChange={() => toggleSelect(user.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/50 shrink-0" />

                          {/* Avatar */}
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                            {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">{user.displayName}</span>
                              {user.roles.filter((r) => r !== tab.key).map((r) => {
                                const rc = ROLE_TABS.find((t) => t.key === r)
                                if (!rc) return null
                                const RIcon = rc.icon
                                return (
                                  <Badge key={r} variant={rc.badgeVariant} className="text-xs shrink-0">
                                    <RIcon className="h-3 w-3 mr-0.5" />{rc.label}
                                  </Badge>
                                )
                              })}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>

                          {/* Password reset button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
                            onClick={() => setResetTarget(user)}
                            title="パスワード再発行"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>

                          {/* Role change button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => { setChangeTarget(user); setChangeToRoleKey('') }}
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                            <span className="hidden sm:inline">変更</span>
                          </Button>

                          {/* Remove button (not on none tab) */}
                          {!isThisNoneTab && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => {
                                const roleId = roles.find((r) => r.name === tab.key)?.id
                                if (roleId) setRemoveTarget({ user, roleName: tab.key, roleId })
                              }}
                              title="このロールから解除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Single assign dialog (add user to a role) */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {assignRoleKey
                ? `${ROLE_TABS.find((t) => t.key === assignRoleKey)?.label}ロールにユーザーを追加`
                : 'ロールを割り当て'}
            </DialogTitle>
            <DialogDescription>
              {assignRoleKey
                ? `${ROLE_TABS.find((t) => t.key === assignRoleKey)?.label}ロールに追加するユーザーを選択してください。`
                : '割り当てるロールとユーザーを選択してください。'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {!assignRoleKey && (
              <div className="space-y-1.5">
                <Label>ロール</Label>
                <Select value={assignRoleKey} onValueChange={(v) => { if (v) setAssignRoleKey(v) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="ロールを選択">
                      {assignRoleKey ? ROLE_TABS.find((t) => t.key === assignRoleKey)?.label || assignRoleKey : 'ロールを選択'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => {
                      const t = ROLE_TABS.find((t) => t.key === r.name)
                      return <SelectItem key={r.id} value={r.name}>{t?.label || r.name}</SelectItem>
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            {assignRoleKey && !selectedUserId && (
              <div className="space-y-1.5">
                <Label>ユーザー</Label>
                <Select value={selectedUserId} onValueChange={(v) => { if (v) setSelectedUserId(v) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="ユーザーを選択">
                      {selectedUserId ? users.find((u) => u.id === selectedUserId)?.displayName || selectedUserId : 'ユーザーを選択'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableUsersForRole(assignRoleKey).length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">追加可能なユーザーがいません</div>
                    ) : (
                      getAvailableUsersForRole(assignRoleKey).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.displayName} <span className="text-muted-foreground">({u.email})</span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedUserId && !assignRoleKey && (
              <div className="rounded-lg border p-3 text-sm">
                <span className="font-medium">{users.find((u) => u.id === selectedUserId)?.displayName}</span>
                <span className="text-muted-foreground ml-1">({users.find((u) => u.id === selectedUserId)?.email})</span>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setAssignOpen(false); setAssignRoleKey(''); setSelectedUserId('') }}>キャンセル</Button>
            <Button onClick={handleAssignRole} disabled={!selectedUserId || !assignRoleKey || assigning}>
              {assigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}割り当て
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role change dialog (single user) */}
      <Dialog open={!!changeTarget} onOpenChange={(open) => { if (!open) { setChangeTarget(null); setChangeToRoleKey('') } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ロール変更</DialogTitle>
            <DialogDescription>
              {changeTarget?.displayName} のロールを変更します。
              {activeTab !== 'none' && ` 現在の${ROLE_TABS.find((t) => t.key === activeTab)?.label}ロールは解除されます。`}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{changeTarget?.displayName}</span>
                <span className="text-muted-foreground">({changeTarget?.email})</span>
              </div>
              {changeTarget && changeTarget.roles.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-xs text-muted-foreground">現在:</span>
                  {changeTarget.roles.map((r) => {
                    const rc = ROLE_TABS.find((t) => t.key === r)
                    if (!rc) return null
                    const RIcon = rc.icon
                    return (
                      <Badge key={r} variant={rc.badgeVariant} className="text-xs">
                        <RIcon className="h-3 w-3 mr-0.5" />{rc.label}
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>変更先ロール</Label>
              <Select value={changeToRoleKey} onValueChange={(v) => { if (v) setChangeToRoleKey(v) }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="ロールを選択">
                    {changeToRoleKey ? ROLE_TABS.find((t) => t.key === changeToRoleKey)?.label || changeToRoleKey : 'ロールを選択'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles
                    .filter((r) => r.name !== activeTab)
                    .filter((r) => !changeTarget?.roles.includes(r.name))
                    .map((r) => {
                      const t = ROLE_TABS.find((t) => t.key === r.name)
                      return (
                        <SelectItem key={r.id} value={r.name}>
                          {t?.label || r.name}
                          {r.name === 'owner' && ' (役員向け)'}
                        </SelectItem>
                      )
                    })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setChangeTarget(null); setChangeToRoleKey('') }}>キャンセル</Button>
            <Button onClick={handleChangeRole} disabled={!changeToRoleKey || changingRole}>
              {changingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}変更する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk assign/change dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>一括ロール変更</DialogTitle>
            <DialogDescription>
              {selectedUserIds.size}名のユーザーにロールを一括で割り当てます。
              {!isNoneTab && `現在の${ROLE_TABS.find((t) => t.key === activeTab)?.label}ロールはそのまま維持されます。`}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>割り当てるロール</Label>
              <Select value={bulkAssignRoleKey} onValueChange={(v) => { if (v) setBulkAssignRoleKey(v) }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="ロールを選択">
                    {bulkAssignRoleKey ? ROLE_TABS.find((t) => t.key === bulkAssignRoleKey)?.label || bulkAssignRoleKey : 'ロールを選択'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => {
                    const t = ROLE_TABS.find((t) => t.key === r.name)
                    return (
                      <SelectItem key={r.id} value={r.name}>
                        {t?.label || r.name}
                        {r.name === 'owner' && ' (役員向け)'}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-2">対象ユーザー:</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selectedUserIds).map((uid) => {
                  const u = users.find((u) => u.id === uid)
                  return <Badge key={uid} variant="outline" className="text-xs">{u?.displayName || uid}</Badge>
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setBulkAssignOpen(false); setBulkAssignRoleKey('') }}>キャンセル</Button>
            <Button onClick={handleBulkAssign} disabled={!bulkAssignRoleKey || bulkProcessing}>
              {bulkProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedUserIds.size}名を一括割り当て
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk remove confirm */}
      <Dialog open={bulkRemoveOpen} onOpenChange={setBulkRemoveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>一括ロール解除</DialogTitle>
            <DialogDescription>
              {selectedUserIds.size}名の{ROLE_TABS.find((t) => t.key === activeTab)?.label}ロールを一括で解除しますか？
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 rounded-lg border p-3">
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selectedUserIds).map((uid) => {
                const u = users.find((u) => u.id === uid)
                return <Badge key={uid} variant="outline" className="text-xs">{u?.displayName || uid}</Badge>
              })}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setBulkRemoveOpen(false)}>キャンセル</Button>
            <Button variant="destructive" onClick={handleBulkRemove} disabled={bulkProcessing}>
              {bulkProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedUserIds.size}名を一括解除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single remove dialog */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ロールの解除</DialogTitle>
            <DialogDescription>
              {removeTarget?.user.displayName} の{ROLE_TABS.find((t) => t.key === removeTarget?.roleName)?.label}ロールを解除しますか？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={handleRemoveRole} disabled={removingRole}>
              {removingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}解除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password reset confirm dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" />
              パスワード再発行
            </DialogTitle>
            <DialogDescription>
              {resetTarget?.displayName} のパスワードをリセットしますか？
              新しい初期パスワードが生成され、次回ログイン時にパスワード再設定が必要になります。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setResetTarget(null)}>キャンセル</Button>
            <Button onClick={handleResetPassword} disabled={resettingPassword} className="bg-amber-600 hover:bg-amber-700">
              {resettingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              パスワードを再発行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password reset result dialog */}
      <Dialog open={!!resetResult} onOpenChange={(open) => { if (!open) { setResetResult(null); setCopiedResetPw(false) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              パスワード再発行完了
            </DialogTitle>
            <DialogDescription>
              {resetResult?.userName} の新しい初期パスワードです。本人にお伝えください。
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">新しい初期パスワード（この画面を閉じると再表示できません）</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-lg font-mono font-bold tracking-wider text-amber-900 dark:text-amber-100">
                  {resetResult?.password}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(resetResult?.password || '')
                    setCopiedResetPw(true)
                    toast.success('コピーしました')
                  }}
                >
                  {copiedResetPw ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              次回ログイン時にパスワードの再設定画面に移行します。
            </p>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={() => { setResetResult(null); setCopiedResetPw(false) }}>閉じる</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
