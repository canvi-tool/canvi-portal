'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle2, KeyRound } from 'lucide-react'

export default function SetupPasswordPage() {
  return (
    <Suspense>
      <SetupPasswordInner />
    </Suspense>
  )
}

function SetupPasswordInner() {
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [needsGoogleLinkOnly, setNeedsGoogleLinkOnly] = useState(false)
  const [googleError, setGoogleError] = useState('')

  // URLパラメータからエラーチェック
  useEffect(() => {
    if (searchParams.get('error') === 'email_mismatch') {
      setGoogleError('Canvi Portalに登録されているメールアドレスと異なるGoogleアカウントが選択されました。正しいアカウントで再度お試しください。')
    }
  }, [searchParams])

  // パスワード設定済みだがGoogle連携未完了のユーザーは直接Google連携画面を表示
  useEffect(() => {
    const checkState = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const meta = user.user_metadata
        if (!meta?.needs_password_setup && meta?.needs_google_link) {
          setNeedsGoogleLinkOnly(true)
        }
      }
    }
    checkState()
  }, [])

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return 'パスワードは8文字以上で入力してください'
    if (!/^[a-zA-Z0-9]+$/.test(pw)) return 'パスワードは半角英数字のみ使用できます'
    if (!/[a-z]/.test(pw)) return 'パスワードに小文字を含めてください'
    if (!/[A-Z]/.test(pw)) return 'パスワードに大文字を含めてください'
    if (!/[0-9]/.test(pw)) return 'パスワードに数字を含めてください'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const validationError = validatePassword(password)
    if (validationError) {
      setError(validationError)
      return
    }
    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { needs_password_setup: false, needs_google_link: true },
      })

      if (updateError) {
        if (updateError.message?.includes('session')) {
          setError('セッションが無効です。メールのリンクを再度クリックしてください。')
        } else {
          setError(updateError.message || 'パスワード設定に失敗しました')
        }
        return
      }

      setDone(true)
    } catch {
      setError('パスワード設定に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const [userEmail, setUserEmail] = useState('')

  // ユーザーのメアドを取得（Google login_hint用）
  useEffect(() => {
    const getEmail = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setUserEmail(user.email)
    }
    getEmail()
  }, [])

  const handleGoogleLink = async () => {
    const supabase = createClient()
    await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/callback`,
        queryParams: {
          login_hint: userEmail,
        },
      },
    })
  }

  if (needsGoogleLinkOnly || done) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 space-y-6">
          <div className="text-center">
            {needsGoogleLinkOnly ? (
              <>
                <KeyRound className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">Googleアカウント連携</h2>
                <p className="text-sm text-muted-foreground">
                  Canvi Portalを利用するにはGoogleアカウントの連携が必要です。
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">パスワード設定完了</h2>
                <p className="text-sm text-muted-foreground">
                  パスワードが正常に設定されました。<br />
                  続いてGoogleアカウントを連携してください。
                </p>
              </>
            )}
          </div>

          {googleError && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950 p-3">
              <p className="text-sm text-red-700 dark:text-red-300">{googleError}</p>
            </div>
          )}

          {/* Google連携（必須） */}
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-4">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
              Googleアカウント連携（必須）
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-3 leading-relaxed">
              Canviで使用しているGoogleアカウントを連携してください。<br />
              連携が完了するとCanvi Portalをご利用いただけます。
            </p>
            <Button
              onClick={handleGoogleLink}
              variant="default"
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Googleアカウントで連携する
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
          C
        </div>
        <CardTitle className="text-2xl">パスワード設定</CardTitle>
        <CardDescription>
          Canvi Portalのパスワードを設定してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">
              <KeyRound className="inline h-4 w-4 mr-1" />
              新しいパスワード
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="半角英数字・大文字小文字混合（8文字以上）"
              className="h-11"
            />
            <p className="text-xs text-muted-foreground mt-1">半角英数字、大文字と小文字の両方を含めてください</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">パスワード（確認）</Label>
            <Input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="もう一度入力"
              className="h-11"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            パスワードを設定してログイン
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
