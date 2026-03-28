'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { RoleManager } from '../_components/role-manager'
import { Skeleton } from '@/components/ui/skeleton'


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

export default function RolesSettingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<RoleWithPermissions[]>([])
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [allUsers, setAllUsers] = useState<UserOption[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/roles')
      if (res.status === 403) {
        router.push('/dashboard')
        return
      }
      if (!res.ok) throw new Error('データの取得に失敗しました')
      const data = await res.json()
      setRoles(data.roles)
      setAllPermissions(data.allPermissions)
      setAllUsers(data.allUsers)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleAssignRole(userId: string, roleId: string) {
    const res = await fetch('/api/settings/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', user_id: userId, role_id: roleId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'ロールの割り当てに失敗しました')
    }
    await fetchData()
  }

  async function handleRemoveRole(userId: string, roleId: string) {
    const res = await fetch('/api/settings/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', user_id: userId, role_id: roleId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'ロールの解除に失敗しました')
    }
    await fetchData()
  }

  async function handleTogglePermission(
    roleId: string,
    permissionId: string,
    enabled: boolean
  ) {
    const res = await fetch('/api/settings/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toggle_permission',
        role_id: roleId,
        permission_id: permissionId,
        enabled,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? '権限の変更に失敗しました')
    }
    await fetchData()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="ロール管理" description="ロールと権限の設定" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="ロール管理" description="ロールと権限の設定" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ロール管理"
        description="ユーザーのロールと権限を管理します。各ロールの権限を切り替え、ユーザーへの割り当てを行えます。"
      />
      <RoleManager
        roles={roles}
        allPermissions={allPermissions}
        allUsers={allUsers}
        onAssignRole={handleAssignRole}
        onRemoveRole={handleRemoveRole}
        onTogglePermission={handleTogglePermission}
      />
    </div>
  )
}
