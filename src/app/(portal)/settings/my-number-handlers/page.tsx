'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  UserPlus,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'

interface MyNumberHandler {
  userId: string
  email: string | null
  displayName: string | null
  grantedAt: string
  reason: string
  expiresAt: string | null
}

interface UserOption {
  id: string
  display_name: string
  email: string
}

export default function MyNumberHandlersPage() {
  const router = useRouter()
  const [handlers, setHandlers] = useState<MyNumberHandler[]>([])
  const [allUsers, setAllUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add dialog
  const [addOpen, setAddOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [reason, setReason] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [adding, setAdding] = useState(false)

  // Remove dialog
  const [removeTarget, setRemoveTarget] = useState<MyNumberHandler | null>(null)
  const [removing, setRemoving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [handlersRes, usersRes] = await Promise.all([
        fetch('/api/settings/my-number-handlers'),
        fetch('/api/users'),
      ])

      if (handlersRes.status === 403) {
        router.push('/dashboard')
        return
      }

      if (!handlersRes.ok) throw new Error('担当者一覧の取得に失敗しました')

      const handlersData = await handlersRes.json()
      setHandlers(handlersData.handlers || [])

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setAllUsers(usersData.users || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAdd = async () => {
    if (!selectedUserId || !reason.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/settings/my-number-handlers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          reason: reason.trim(),
          expiresAt: expiresAt || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '追加に失敗しました')
        return
      }
      toast.success('マイナンバー担当者を追加しました')
      setAddOpen(false)
      setSelectedUserId('')
      setReason('')
      setExpiresAt('')
      fetchData()
    } catch {
      toast.error('追加に失敗しました')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      const res = await fetch('/api/settings/my-number-handlers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: removeTarget.userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '解除に失敗しました')
        return
      }
      toast.success('マイナンバー担当者を解除しました')
      setRemoveTarget(null)
      fetchData()
    } catch {
      toast.error('解除に失敗しました')
    } finally {
      setRemoving(false)
    }
  }

  // Filter out users who are already handlers
  const handlerUserIds = new Set(handlers.map((h) => h.userId))
  const availableUsers = allUsers.filter((u) => !handlerUserIds.has(u.id))

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="マイナンバー担当者管理"
          description="本人確認書類・マイナンバー関連情報の閲覧権限を管理します"
        />
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
        <PageHeader
          title="マイナンバー担当者管理"
          description="本人確認書類・マイナンバー関連情報の閲覧権限を管理します"
        />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="マイナンバー担当者管理"
        description="マイナンバー法に基づく特定個人情報取扱担当者の指定・管理を行います。オーナーのみ操作可能です。"
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            担当者を追加
          </Button>
        }
      />

      {/* 法令遵守ガイダンス */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">マイナンバー法に基づく安全管理措置</p>
            <ul className="mt-1 list-disc list-inside space-y-0.5 text-amber-700 dark:text-amber-300">
              <li>特定個人情報の取扱担当者は必要最小限に限定してください</li>
              <li>担当者の指定には付与理由の記録が必須です（監査証跡）</li>
              <li>有効期限を設定し、定期的な見直しを推奨します（例: 1年ごと）</li>
              <li>担当者の追加・削除は監査ログに自動記録されます</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 担当者一覧 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">指定済み担当者</CardTitle>
              <CardDescription>
                {handlers.length > 0
                  ? `${handlers.length}名の担当者が指定されています`
                  : 'オーナーは自動的にアクセス権を持ちます'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {handlers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ShieldCheck className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">担当者が指定されていません</p>
              <p className="text-xs mt-1">
                オーナーは常にマイナンバー関連情報にアクセスできます
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {handlers.map((handler) => {
                const isExpired =
                  handler.expiresAt && new Date(handler.expiresAt) < new Date()
                const isExpiringSoon =
                  handler.expiresAt &&
                  !isExpired &&
                  new Date(handler.expiresAt).getTime() - Date.now() <
                    30 * 24 * 60 * 60 * 1000

                return (
                  <div
                    key={handler.userId}
                    className="flex items-center gap-4 px-6 py-4"
                  >
                    {/* アバター */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {handler.displayName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>

                    {/* 情報 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {handler.displayName || '不明'}
                        </span>
                        {isExpired ? (
                          <Badge variant="destructive" className="text-xs shrink-0">
                            期限切れ
                          </Badge>
                        ) : isExpiringSoon ? (
                          <Badge
                            variant="secondary"
                            className="text-xs shrink-0 bg-amber-100 text-amber-700"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            まもなく期限
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            有効
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {handler.email}
                      </p>
                    </div>

                    {/* 付与理由・期限 */}
                    <div className="hidden md:block text-right">
                      <p className="text-xs text-muted-foreground">
                        <Info className="inline h-3 w-3 mr-1" />
                        {handler.reason}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        付与:{' '}
                        {new Date(handler.grantedAt).toLocaleDateString('ja-JP')}
                        {handler.expiresAt && (
                          <>
                            {' / '}期限:{' '}
                            {new Date(handler.expiresAt).toLocaleDateString(
                              'ja-JP'
                            )}
                          </>
                        )}
                      </p>
                    </div>

                    {/* 削除ボタン */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setRemoveTarget(handler)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 追加ダイアログ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>マイナンバー担当者を追加</DialogTitle>
            <DialogDescription>
              指定されたユーザーは本人確認書類・マイナンバー関連情報を閲覧できるようになります。
              この操作は監査ログに記録されます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>
                対象ユーザー <span className="text-red-500">*</span>
              </Label>
              <Select
                value={selectedUserId}
                onValueChange={(v) => {
                  if (v) setSelectedUserId(v)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="ユーザーを選択">
                    {selectedUserId
                      ? availableUsers.find((u) => u.id === selectedUserId)
                          ?.display_name ?? selectedUserId
                      : 'ユーザーを選択'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      追加可能なユーザーがいません
                    </div>
                  ) : (
                    availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.display_name}{' '}
                        <span className="text-muted-foreground">
                          ({u.email})
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                付与理由 <span className="text-red-500">*</span>
              </Label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                placeholder="例: 人事部門として入社手続きに必要なため"
                rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
              />
              <p className="text-xs text-muted-foreground">
                マイナンバー法の安全管理措置として記録されます
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>有効期限（任意）</Label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-muted-foreground">
                定期的な見直しのため、1年後の設定を推奨します
              </p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!selectedUserId || !reason.trim() || adding}
            >
              {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              担当者を追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>担当者の解除</DialogTitle>
            <DialogDescription>
              {removeTarget?.displayName || removeTarget?.email}{' '}
              のマイナンバー担当者権限を解除しますか？
              この操作は監査ログに記録されます。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              解除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
