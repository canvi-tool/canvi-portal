'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Loader2, UserPlus, Mail, Crown, Shield, User } from 'lucide-react'
import { toast } from 'sonner'
import { ALLOWED_EMAIL_DOMAINS } from '@/lib/constants'

interface PortalUser {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  created_at: string
  roles: string[]
}

const ROLE_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; icon: typeof Crown }> = {
  owner: { label: 'オーナー', variant: 'default', icon: Crown },
  admin: { label: '管理者', variant: 'secondary', icon: Shield },
  staff: { label: 'スタッフ', variant: 'outline', icon: User },
}

export default function SettingsUsersPage() {
  const [users, setUsers] = useState<PortalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'staff'>('staff')
  const [inviting, setInviting] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('取得失敗')
      const data = await res.json()
      setUsers(data.users)
    } catch {
      toast.error('ユーザー一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          display_name: inviteName,
          role: inviteRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '招待に失敗しました')
        return
      }
      toast.success(data.message || '招待メールを送信しました')
      setInviteOpen(false)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('staff')
      fetchUsers()
    } catch {
      toast.error('招待に失敗しました')
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ポータルユーザー管理"
        description="ポータルにログインできるユーザーを管理します。招待されたユーザーのみログイン可能です。"
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            ユーザーを招待
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              登録済みのユーザーはいません
            </div>
          ) : (
            <div className="divide-y">
              {users.map((user) => {
                const primaryRole = user.roles[0] || 'staff'
                const roleInfo = ROLE_BADGE[primaryRole] || ROLE_BADGE.staff
                const RoleIcon = roleInfo.icon
                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-4 px-6 py-4"
                  >
                    {/* アバター */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.avatar_url}
                          alt=""
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        user.display_name?.charAt(0)?.toUpperCase() || 'U'
                      )}
                    </div>

                    {/* 情報 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {user.display_name}
                        </span>
                        <Badge variant={roleInfo.variant} className="text-xs shrink-0">
                          <RoleIcon className="h-3 w-3 mr-1" />
                          {roleInfo.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>

                    {/* 登録日 */}
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString('ja-JP')
                        : '-'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 招待ダイアログ */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ユーザーを招待</DialogTitle>
            <DialogDescription>
              招待メールが送信され、リンクからパスワード設定後にログインできます。
              @{ALLOWED_EMAIL_DOMAINS[0]} ドメインのみ招待可能です。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                表示名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                required
                placeholder="例: 田中 太郎"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder={`name@${ALLOWED_EMAIL_DOMAINS[0]}`}
                  className="w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ロール</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'staff')}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="staff">スタッフ</option>
                <option value="admin">管理者</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                招待メールを送信
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
