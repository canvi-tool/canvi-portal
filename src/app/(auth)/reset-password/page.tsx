'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { APP_NAME } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Lock, CheckCircle2, Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
    setError(null)

    const validationError = validatePassword(password)
    if (validationError) {
      setError(validationError)
      return
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { needs_password_setup: false },
      })
      if (updateError) throw updateError
      setSuccess(true)
      // 3秒後にダッシュボードへリダイレクト
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
    } catch (err: unknown) {
      const authErr = err as { message?: string }
      if (authErr.message?.includes('session')) {
        setError('セッションが無効です。もう一度パスワードリセットをお試しください。')
      } else {
        setError(authErr.message || 'パスワードの更新に失敗しました')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <CardTitle className="text-xl">パスワードを変更しました</CardTitle>
          <CardDescription className="mt-2">
            新しいパスワードが設定されました。
            <br />
            <span className="text-xs text-slate-400">3秒後にダッシュボードに移動します...</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => router.push('/dashboard')}
            className="w-full"
          >
            ダッシュボードへ
          </Button>
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
        <CardTitle className="text-2xl">{APP_NAME}</CardTitle>
        <CardDescription>
          新しいパスワードを設定してください
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <Lock className="inline h-4 w-4 mr-1 -mt-0.5" />
              新しいパスワード
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 pr-10 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
                placeholder="半角英数字・大文字小文字混合（8文字以上）"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <Lock className="inline h-4 w-4 mr-1 -mt-0.5" />
              パスワード確認
            </label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
              placeholder="もう一度入力"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11"
            size="lg"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            パスワードを変更
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
