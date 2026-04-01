'use client'

import { useState, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { ChevronDown, ChevronRight, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'

interface Permission {
  id: string
  resource: string
  action: string
  description: string | null
}

interface RoleWithPermissions {
  id: string
  name: string
  description: string | null
  permissions: Permission[]
  users: { id: string; display_name: string; email: string }[]
}

interface UserOption {
  id: string
  display_name: string
  email: string
}

interface RoleManagerProps {
  roles: RoleWithPermissions[]
  allPermissions: Permission[]
  allUsers: UserOption[]
  onAssignRole: (userId: string, roleId: string) => Promise<void>
  onRemoveRole: (userId: string, roleId: string) => Promise<void>
  onTogglePermission: (roleId: string, permissionId: string, enabled: boolean) => Promise<void>
}

function groupPermissionsByResource(permissions: Permission[]) {
  const grouped: Record<string, Permission[]> = {}
  for (const p of permissions) {
    if (!grouped[p.resource]) grouped[p.resource] = []
    grouped[p.resource].push(p)
  }
  return grouped
}

const RESOURCE_LABELS: Record<string, string> = {
  staff: 'スタッフ',
  contract: '契約',
  project: 'プロジェクト',
  shift: 'シフト',
  work_report: '勤務報告',
  performance_report: '業務実績',
  payment: '支払',
  notification: '通知',
  retirement: '退職',
  alert: 'アラート',
  settings: '設定',
  audit_log: '監査ログ',
}

const ACTION_LABELS: Record<string, string> = {
  create: '作成',
  read: '閲覧',
  update: '更新',
  delete: '削除',
  approve: '承認',
  export: 'エクスポート',
  manage: '管理',
}

const ROLE_LABELS: Record<string, { name: string; desc: string }> = {
  owner: { name: 'オーナー', desc: 'システムオーナー - 全権限' },
  admin: { name: '管理者', desc: '管理者 - 日常運用権限' },
  staff: { name: 'メンバー', desc: 'スタッフ - 自分の情報のみ' },
}

export function RoleManager({
  roles,
  allPermissions,
  allUsers,
  onAssignRole,
  onRemoveRole,
  onTogglePermission,
}: RoleManagerProps) {
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set())
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [togglingPerm, setTogglingPerm] = useState<string | null>(null)

  const allGrouped = groupPermissionsByResource(allPermissions)

  const toggleExpanded = useCallback((roleId: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev)
      if (next.has(roleId)) next.delete(roleId)
      else next.add(roleId)
      return next
    })
  }, [])

  async function handleAssign() {
    if (!selectedUserId || !selectedRoleId) return
    setAssigning(true)
    try {
      await onAssignRole(selectedUserId, selectedRoleId)
      toast.success('ロールを割り当てました')
      setAssignDialogOpen(false)
      setSelectedUserId('')
      setSelectedRoleId('')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'ロールの割り当てに失敗しました')
    } finally {
      setAssigning(false)
    }
  }

  async function handleRemoveUser(userId: string, roleId: string) {
    try {
      await onRemoveRole(userId, roleId)
      toast.success('ロールを解除しました')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'ロールの解除に失敗しました')
    }
  }

  async function handleTogglePermission(
    roleId: string,
    permissionId: string,
    currentEnabled: boolean
  ) {
    const key = `${roleId}-${permissionId}`
    setTogglingPerm(key)
    try {
      await onTogglePermission(roleId, permissionId, !currentEnabled)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '権限の変更に失敗しました')
    } finally {
      setTogglingPerm(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm">
                <UserPlus className="h-4 w-4 mr-1" />
                ロール割り当て
              </Button>
            }
          />
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>ロール割り当て</DialogTitle>
              <DialogDescription>
                ユーザーにロールを割り当てます。
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>ユーザー</Label>
                <Select value={selectedUserId} onValueChange={(v) => { if (v) setSelectedUserId(v) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="ユーザーを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ロール</Label>
                <Select value={selectedRoleId} onValueChange={(v) => { if (v) setSelectedRoleId(v) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="ロールを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {ROLE_LABELS[r.name]?.name ?? r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                onClick={handleAssign}
                disabled={!selectedUserId || !selectedRoleId || assigning}
              >
                {assigning ? '割り当て中...' : '割り当て'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {roles.map((role) => {
        const isExpanded = expandedRoles.has(role.id)
        const isOwner = role.name === 'owner'
        const rolePermIds = new Set(role.permissions.map((p) => p.id))

        return (
          <Card key={role.id}>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => toggleExpanded(role.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {ROLE_LABELS[role.name]?.name ?? role.name}
                      {isOwner && (
                        <Badge variant="default">全権限</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-0.5">
                      {ROLE_LABELS[role.name]?.desc ?? role.description ?? ''}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary">
                  {role.users.length} ユーザー
                </Badge>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-4">
                {/* ユーザー一覧 */}
                {role.users.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">割り当て済みユーザー</h4>
                    <div className="flex flex-wrap gap-2">
                      {role.users.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm"
                        >
                          <span>{u.display_name}</span>
                          {!isOwner && (
                            <button
                              onClick={() => handleRemoveUser(u.id, role.id)}
                              className="ml-1 text-muted-foreground hover:text-destructive"
                              title="ロールを解除"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 権限一覧 */}
                <div>
                  <h4 className="text-sm font-medium mb-2">権限</h4>
                  {isOwner ? (
                    <p className="text-sm text-muted-foreground">
                      オーナーはすべての権限を持ちます。権限の変更はできません。
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(allGrouped).map(([resource, perms]) => (
                        <div key={resource}>
                          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            {RESOURCE_LABELS[resource] ?? resource}
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {perms.map((perm) => {
                              const enabled = rolePermIds.has(perm.id)
                              const toggling =
                                togglingPerm === `${role.id}-${perm.id}`
                              return (
                                <label
                                  key={perm.id}
                                  className="flex items-center gap-1.5 text-sm cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={enabled}
                                    disabled={toggling}
                                    onChange={() =>
                                      handleTogglePermission(
                                        role.id,
                                        perm.id,
                                        enabled
                                      )
                                    }
                                    className="h-3.5 w-3.5 rounded border-gray-300"
                                  />
                                  <span>
                                    {ACTION_LABELS[perm.action] ?? perm.action}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
