'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
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

      // 3秒後にダッシュボードへ
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
    } catch {
      setError('パスワード設定に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">パスワード設定完了</h2>
          <p className="text-sm text-muted-foreground">
            アカウントが有効化されました。<br />
            ダッシュボードにリダイレクトします...
          </p>
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
              placeholder="8文字以上"
              className="h-11"
            />
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
