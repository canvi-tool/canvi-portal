'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CheckCircle2,
  XCircle,
  KeyRound,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

interface GoogleAuthUser {
  id: string
  email: string
  display_name: string
  google_linked: boolean
  google_email: string | null
  password_setup_done: boolean
}

export default function GoogleAuthPage() {
  const router = useRouter()
  const [users, setUsers] = useState<GoogleAuthUser[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/google-auth')
      if (res.status === 403) {
        router.push('/dashboard')
        return
      }
      if (!res.ok) throw new Error('データの取得に失敗しました')
      const data = await res.json()
      setUsers(data.users || [])
    } catch {
      toast.error('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  const linkedCount = users.filter((u) => u.google_linked).length
  const unlinkedCount = users.filter((u) => !u.google_linked).length
  const passwordPendingCount = users.filter((u) => !u.password_setup_done).length

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Googleアカウント連携管理" description="メンバーのGoogleアカウント連携状況を確認します" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Googleアカウント連携管理"
        description="全メンバーのGoogleアカウント連携状況を一覧で確認できます。各メンバーは自分のアカウント設定からGoogle連携を行います。"
      />

      {/* サマリーカード */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{linkedCount}</p>
                <p className="text-xs text-muted-foreground">Google連携済</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unlinkedCount}</p>
                <p className="text-xs text-muted-foreground">未連携</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{passwordPendingCount}</p>
                <p className="text-xs text-muted-foreground">PW未設定</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ガイダンス */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-4">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Google連携の手順</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300">
              <li>メンバーが初期パスワードでログイン</li>
              <li>パスワード設定画面で自分のパスワードを設定</li>
              <li>ログイン画面の「Googleアカウントでログイン」ボタンで連携</li>
            </ol>
            <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
              全メンバーのパスワード設定が完了したら、Googleログインが利用可能になります。
            </p>
          </div>
        </div>
      </div>

      {/* ユーザー一覧 */}
      <Card>
        <div className="px-6 py-4 border-b">
          <h3 className="text-sm font-semibold">メンバー一覧</h3>
          <p className="text-xs text-muted-foreground">全{users.length}名のGoogleアカウント連携状況</p>
        </div>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">メンバーがいません</p>
            </div>
          ) : (
            <div className="divide-y">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-4 px-6 py-3">
                  {/* Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {user.display_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{user.display_name}</span>
                      {!user.password_setup_done && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                          <KeyRound className="h-3 w-3 mr-0.5" />
                          PW未設定
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>

                  {/* Google status */}
                  {user.google_linked ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-0">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Google連携済
                      </Badge>
                      {user.google_email && user.google_email !== user.email && (
                        <span className="text-xs text-muted-foreground hidden sm:block">{user.google_email}</span>
                      )}
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-red-600 border-red-300 dark:text-red-400 dark:border-red-700 shrink-0">
                      <XCircle className="h-3 w-3 mr-1" />
                      未連携
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
