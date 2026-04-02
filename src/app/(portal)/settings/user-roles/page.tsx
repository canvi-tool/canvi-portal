'use client'

import { useState, useEffect, useCallback } from 'react'
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
    description: 'システム全権限を持つオーナー',
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

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignRoleKey, setAssignRoleKey] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Remove dialog
  const [removeTarget, setRemoveTarget] = useState<{
    user: UserWithRoles
    roleName: string
    roleId: string
  } | null>(null)
  const [removingRole, setRemovingRole] = useState(false)

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
        userMap.set(u.id, {
          id: u.id,
          displayName: u.display_name,
          email: u.email,
          roles: [],
        })
      }

      for (const role of data.roles || []) {
        for (const u of role.users || []) {
          const existing = userMap.get(u.id)
          if (existing) {
            existing.roles.push(role.name)
          } else {
            userMap.set(u.id, {
              id: u.id,
              displayName: u.display_name,
              email: u.email,
              roles: [role.name],
            })
          }
        }
      }

      setUsers(
        Array.from(userMap.values()).sort((a, b) =>
          a.displayName.localeCompare(b.displayName, 'ja')
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Users filtered by role tab
  const getUsersForTab = (tabKey: string) => {
    if (tabKey === 'none') return users.filter((u) => u.roles.length === 0)
    return users.filter((u) => u.roles.includes(tabKey))
  }

  // Available users to add to a role (not already in that role)
  const getAvailableUsersForRole = (roleKey: string) => {
    return users.filter((u) => !u.roles.includes(roleKey))
  }

  const handleAssignRole = async () => {
    if (!selectedUserId || !assignRoleKey) return
    const roleId = roles.find((r) => r.name === assignRoleKey)?.id
    if (!roleId) return

    setAssigning(true)
    try {
      const res = await fetch('/api/settings/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          user_id: selectedUserId,
          role_id: roleId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'ロールの割り当てに失敗しました')
        return
      }
      const userName = users.find((u) => u.id === selectedUserId)?.displayName
      toast.success(`${userName} にロールを割り当てました`)
      setAssignOpen(false)
      setSelectedUserId('')
      fetchData()
    } catch {
      toast.error('ロールの割り当てに失敗しました')
    } finally {
      setAssigning(false)
    }
  }

  const handleRemoveRole = async () => {
    if (!removeTarget) return
    setRemovingRole(true)
    try {
      const res = await fetch('/api/settings/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          user_id: removeTarget.user.id,
          role_id: removeTarget.roleId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'ロールの解除に失敗しました')
        return
      }
      const tabConfig = ROLE_TABS.find((t) => t.key === removeTarget.roleName)
      toast.success(
        `${removeTarget.user.displayName} の${tabConfig?.label || removeTarget.roleName}ロールを解除しました`
      )
      setRemoveTarget(null)
      fetchData()
    } catch {
      toast.error('ロールの解除に失敗しました')
    } finally {
      setRemovingRole(false)
    }
  }

  const openAssignDialog = (roleKey: string) => {
    setAssignRoleKey(roleKey)
    setSelectedUserId('')
    setAssignOpen(true)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="ユーザーロール管理" description="全ユーザーのロールを管理します" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
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

      <Tabs defaultValue="owner">
        <TabsList className="w-full sm:w-auto">
          {ROLE_TABS.map((tab) => {
            const Icon = tab.icon
            const count = getUsersForTab(tab.key).length
            return (
              <TabsTrigger key={tab.key} value={tab.key}>
                <Icon className="h-4 w-4 mr-1.5" />
                {tab.label}
                <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-xs">
                  {count}
                </Badge>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {ROLE_TABS.map((tab) => {
          const tabUsers = getUsersForTab(tab.key)
          const Icon = tab.icon
          const isOwnerTab = tab.key === 'owner'
          const isNoneTab = tab.key === 'none'

          return (
            <TabsContent key={tab.key} value={tab.key}>
              <Card>
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
                  {!isOwnerTab && !isNoneTab && (
                    <Button
                      size="sm"
                      onClick={() => openAssignDialog(tab.key)}
                    >
                      <UserPlus className="h-4 w-4 mr-1.5" />
                      追加
                    </Button>
                  )}
                </div>

                <CardContent className="p-0">
                  {tabUsers.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Icon className="mx-auto h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">
                        {isNoneTab
                          ? 'ロール未割当のユーザーはいません'
                          : `${tab.label}ロールのユーザーはいません`}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {tabUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center gap-4 px-6 py-3"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                            {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">
                                {user.displayName}
                              </span>
                              {/* 他のロールもバッジで表示 */}
                              {user.roles
                                .filter((r) => r !== tab.key)
                                .map((r) => {
                                  const rc = ROLE_TABS.find((t) => t.key === r)
                                  if (!rc) return null
                                  const RIcon = rc.icon
                                  return (
                                    <Badge
                                      key={r}
                                      variant={rc.badgeVariant}
                                      className="text-xs shrink-0"
                                    >
                                      <RIcon className="h-3 w-3 mr-0.5" />
                                      {rc.label}
                                    </Badge>
                                  )
                                })}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.email}
                            </p>
                          </div>

                          {/* 解除ボタン（ownerタブは解除不可） */}
                          {!isOwnerTab && !isNoneTab && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => {
                                const roleId = roles.find((r) => r.name === tab.key)?.id
                                if (roleId) {
                                  setRemoveTarget({
                                    user,
                                    roleName: tab.key,
                                    roleId,
                                  })
                                }
                              }}
                              title="このロールから解除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}

                          {/* 未割当タブはロール割り当てボタン */}
                          {isNoneTab && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              onClick={() => {
                                setAssignRoleKey('')
                                setSelectedUserId(user.id)
                                setAssignOpen(true)
                              }}
                            >
                              <UserCog className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">割り当て</span>
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

      {/* ロール割り当てダイアログ */}
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
            {/* ロール選択（未割当タブから開いた場合） */}
            {!assignRoleKey && (
              <div className="space-y-1.5">
                <Label>ロール</Label>
                <Select
                  value={assignRoleKey}
                  onValueChange={(v) => { if (v) setAssignRoleKey(v) }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="ロールを選択">
                      {assignRoleKey
                        ? ROLE_TABS.find((t) => t.key === assignRoleKey)?.label || assignRoleKey
                        : 'ロールを選択'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {roles
                      .filter((r) => r.name !== 'owner')
                      .map((r) => {
                        const tab = ROLE_TABS.find((t) => t.key === r.name)
                        return (
                          <SelectItem key={r.id} value={r.name}>
                            {tab?.label || r.name}
                          </SelectItem>
                        )
                      })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ユーザー選択（ロールタブから開いた場合） */}
            {assignRoleKey && !selectedUserId && (
              <div className="space-y-1.5">
                <Label>ユーザー</Label>
                <Select
                  value={selectedUserId}
                  onValueChange={(v) => { if (v) setSelectedUserId(v) }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="ユーザーを選択">
                      {selectedUserId
                        ? users.find((u) => u.id === selectedUserId)?.displayName || selectedUserId
                        : 'ユーザーを選択'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableUsersForRole(assignRoleKey).length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        追加可能なユーザーがいません
                      </div>
                    ) : (
                      getAvailableUsersForRole(assignRoleKey).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.displayName}{' '}
                          <span className="text-muted-foreground">({u.email})</span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 未割当タブの場合: userは選択済み、ロールを選ぶ */}
            {selectedUserId && !assignRoleKey && (
              <div className="rounded-lg border p-3 text-sm">
                <span className="font-medium">
                  {users.find((u) => u.id === selectedUserId)?.displayName}
                </span>
                <span className="text-muted-foreground ml-1">
                  ({users.find((u) => u.id === selectedUserId)?.email})
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setAssignOpen(false)
                setAssignRoleKey('')
                setSelectedUserId('')
              }}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleAssignRole}
              disabled={!selectedUserId || !assignRoleKey || assigning}
            >
              {assigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              割り当て
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ロール解除確認ダイアログ */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ロールの解除</DialogTitle>
            <DialogDescription>
              {removeTarget?.user.displayName} の
              {ROLE_TABS.find((t) => t.key === removeTarget?.roleName)?.label || removeTarget?.roleName}
              ロールを解除しますか？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveRole}
              disabled={removingRole}
            >
              {removingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              解除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
