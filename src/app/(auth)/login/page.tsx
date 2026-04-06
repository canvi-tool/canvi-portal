'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { APP_NAME, ALLOWED_EMAIL_DOMAINS } from '@/lib/constants'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

/** メールドメインが許可リストに含まれるか */
function isAllowedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return ALLOWED_EMAIL_DOMAINS.includes(domain ?? '')
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(() => {
    const urlError = searchParams.get('error')
    if (urlError === 'domain_not_allowed') {
      return `@${ALLOWED_EMAIL_DOMAINS[0]} ドメインのアカウントのみログインできます`
    }
    if (urlError === 'email_mismatch') {
      return 'ポータルに登録されているメールアドレスと同じGoogleアカウントでログインしてください'
    }
    if (urlError === 'auth_failed') {
      return '認証に失敗しました。もう一度お試しください。'
    }
    return null
  })
  const [message, setMessage] = useState<string | null>(null)
  const [showEmailLogin, setShowEmailLogin] = useState(false)

  // Google OAuth ログイン（本番用）
  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/callback`,
          scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
    } catch (error) {
      console.error('ログインエラー:', error)
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
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) throw signInError
      // 初回ログイン: パスワード未設定 or Google連携未完了 → セットアップ画面へ
      if (signInData.user?.user_metadata?.needs_password_setup || signInData.user?.user_metadata?.needs_google_link) {
        window.location.href = '/setup-password'
        return
      }
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

  // 本番モード: Google OAuth（メイン） + メールログイン（フォールバック）
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
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {message && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
        )}

        {/* Google OAuth（メイン） */}
        <Button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full h-12 text-base font-medium bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm"
          size="lg"
          variant="outline"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <svg className="mr-2.5 h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          Googleアカウントでログイン
        </Button>

        <p className="text-xs text-center text-slate-400 dark:text-slate-500">
          Googleカレンダー連携が自動的に有効になります
        </p>

        {/* メールログイン（折りたたみ） */}
        {!showEmailLogin ? (
          <button
            onClick={() => setShowEmailLogin(true)}
            className="w-full text-center text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-2"
          >
            メールアドレスでログイン
          </button>
        ) : (
          <>
            {/* 区切り線 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-slate-950 px-2 text-slate-400">メールアドレスでログイン</span>
              </div>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-3">
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
                  placeholder="パスワードを入力"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10"
                size="default"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                ログイン
              </Button>
            </form>

            <p className="text-xs text-center text-slate-400 dark:text-slate-500 px-1">
              パスワードを忘れた場合は、オーナー（管理者）にパスワード再発行を依頼してください
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
