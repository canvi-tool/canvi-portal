'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { APP_NAME, ALLOWED_EMAIL_DOMAINS } from '@/lib/constants'
import { DEMO_ACCOUNTS, setDemoRoleCookie, type DemoRole } from '@/lib/demo-accounts'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Crown, Shield, User, ChevronRight, Lock } from 'lucide-react'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

/** メールドメインが許可リストに含まれるか */
function isAllowedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return ALLOWED_EMAIL_DOMAINS.includes(domain ?? '')
}

const ROLE_ICONS: Record<DemoRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  staff: User,
}

const ROLE_COLORS: Record<DemoRole, string> = {
  owner: 'bg-amber-500',
  admin: 'bg-blue-500',
  staff: 'bg-emerald-500',
}

const ROLE_BORDER_COLORS: Record<DemoRole, string> = {
  owner: 'hover:border-amber-400 focus-visible:border-amber-400',
  admin: 'hover:border-blue-400 focus-visible:border-blue-400',
  staff: 'hover:border-emerald-400 focus-visible:border-emerald-400',
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<DemoRole | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isMagicLink, setIsMagicLink] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    const urlError = searchParams.get('error')
    if (urlError === 'domain_not_allowed') {
      return `@${ALLOWED_EMAIL_DOMAINS[0]} ドメインのアカウントのみログインできます`
    }
    if (urlError === 'auth_failed') {
      return '認証に失敗しました。もう一度お試しください。'
    }
    return null
  })
  const [message, setMessage] = useState<string | null>(null)

  // Google OAuth ログイン（本番用）
  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/callback`,
        },
      })
    } catch (error) {
      console.error('ログインエラー:', error)
      setIsLoading(false)
    }
  }

  // デモモードログイン
  const handleDemoLogin = (role: DemoRole) => {
    setSelectedRole(role)
    setDemoRoleCookie(role)
    setTimeout(() => {
      router.push('/dashboard')
    }, 400)
  }

  // デモモード: ロール選択画面
  if (DEMO_MODE) {
    return (
      <div className="w-full max-w-2xl space-y-6">
        {/* ヘッダー */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 text-2xl font-bold text-white shadow-lg">
            C
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{APP_NAME}</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            テストアカウントを選択してログインしてください
          </p>
          <Badge variant="outline" className="mt-3 text-xs">
            <Lock className="h-3 w-3 mr-1" />
            デモモード
          </Badge>
        </div>

        {/* アカウント選択カード */}
        <div className="grid gap-4">
          {DEMO_ACCOUNTS.map((account) => {
            const RoleIcon = ROLE_ICONS[account.role]
            const isSelected = selectedRole === account.role
            return (
              <button
                key={account.id}
                onClick={() => handleDemoLogin(account.role)}
                disabled={!!selectedRole}
                className={`
                  w-full text-left rounded-xl border-2 bg-white dark:bg-slate-900 p-5
                  transition-all duration-200 outline-none
                  ${isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800 scale-[0.98]'
                    : `border-slate-200 dark:border-slate-700 ${ROLE_BORDER_COLORS[account.role]}`
                  }
                  ${selectedRole && !isSelected ? 'opacity-40' : ''}
                  disabled:cursor-wait
                `}
              >
                <div className="flex items-start gap-4">
                  {/* アバター */}
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${ROLE_COLORS[account.role]} text-white text-lg font-bold shadow-sm`}>
                    {account.avatarInitial}
                  </div>

                  {/* 情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {account.name}
                      </h3>
                      <Badge
                        variant="secondary"
                        className="text-xs"
                      >
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {account.roleLabelJa}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {account.email}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5">
                      {account.description}
                    </p>

                    {/* 権限リスト */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {account.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 矢印 / ローディング */}
                  <div className="shrink-0 mt-1">
                    {isSelected ? (
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* フッター */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          デモモードではデータは保存されません。本番環境ではGoogleアカウントでログインします。
        </p>
      </div>
    )
  }

  // マジックリンクログイン
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    // ドメインチェック（クライアント側）
    if (!isAllowedDomain(email)) {
      setError(`@${ALLOWED_EMAIL_DOMAINS[0]} ドメインのメールアドレスのみ使用できます`)
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error: magicError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/callback`,
        },
      })
      if (magicError) throw magicError
      setMessage('ログインリンクをメールに送信しました。メールを確認してください。')
    } catch (err: unknown) {
      const authErr = err as { message?: string }
      setError(authErr.message || 'メール送信に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    // ドメインチェック（クライアント側）
    if (!isAllowedDomain(email)) {
      setError(`@${ALLOWED_EMAIL_DOMAINS[0]} ドメインのメールアドレスのみ使用できます`)
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) throw signInError
      // Full page reload to ensure middleware reads auth cookies correctly
      window.location.href = '/dashboard'
      return
    } catch (err: unknown) {
      const authErr = err as { message?: string }
      setError(authErr.message || 'ログインに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  // 本番モード: メール + Google OAuth ログイン
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
          C
        </div>
        <CardTitle className="text-2xl">{APP_NAME}</CardTitle>
        <CardDescription>
          業務管理ポータルにログインしてください
          <br />
          <span className="text-xs text-slate-400">※ @{ALLOWED_EMAIL_DOMAINS[0]} のアカウントのみ利用可能</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* マジックリンクログイン（メイン） */}
        <form onSubmit={isMagicLink ? handleMagicLink : handleEmailLogin} className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
              placeholder="you@canvi.co.jp"
            />
          </div>

          {!isMagicLink && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
                placeholder="6文字以上"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {message && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11"
            size="lg"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isMagicLink ? 'ログインリンクを送信' : 'ログイン'}
          </Button>
        </form>

        <div className="flex justify-between items-center text-sm px-1">
          <button
            type="button"
            onClick={() => { setIsMagicLink(!isMagicLink); setError(null); setMessage(null) }}
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {isMagicLink ? 'パスワードでログイン' : 'メールリンクでログイン'}
          </button>
          {!isMagicLink && (
            <Link
              href="/forgot-password"
              className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
            >
              パスワードを忘れた方
            </Link>
          )}
        </div>

        {/* 区切り線 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-slate-950 px-2 text-slate-500">または</span>
          </div>
        </div>

        {/* Google OAuth */}
        <Button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          variant="outline"
          className="w-full h-11"
          size="lg"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          Googleアカウントでログイン
        </Button>
      </CardContent>
    </Card>
  )
}
