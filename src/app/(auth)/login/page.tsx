'use client'

import { useState, Suspense, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { APP_NAME, getCanonicalOrigin } from '@/lib/constants'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

const JP_FONT = "'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif"

function translateError(msg: string | undefined): string {
  if (!msg) return 'エラーが発生しました'
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'メールアドレスまたはパスワードが正しくありません'
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'このメールアドレスは既に登録されています'
  }
  if (m.includes('password should be at least')) {
    return 'パスワードは6文字以上で入力してください'
  }
  if (m.includes('invalid email') || m.includes('unable to validate email')) {
    return 'メールアドレスの形式が正しくありません'
  }
  if (m.includes('email not confirmed')) {
    return 'メールアドレスが確認されていません。受信メールをご確認ください'
  }
  if (m.includes('user not found')) {
    return '該当するアカウントが見つかりません'
  }
  return msg
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
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(() => {
    const urlError = searchParams.get('error')
    if (urlError === 'email_mismatch') {
      return 'ポータルに登録されているメールアドレスと同じGoogleアカウントでログインしてください'
    }
    if (urlError === 'auth_failed') {
      return '認証に失敗しました。もう一度お試しください。'
    }
    return null
  })
  const [message, setMessage] = useState<string | null>(null)

  // Canonical host guard: もしユーザーが *.vercel.app 等、canonical以外のhostで
  // login画面を見ている場合（ブラウザキャッシュ等の理由で 308 が効いていないケース）は
  // クライアント側で強制的に canonical host へ移動させる。これを行わないと
  // Google OAuth の PKCE code_verifier cookie が別host に保存され、
  // callback で PKCE 検証に失敗して /login へループする。
  useEffect(() => {
    if (typeof window === 'undefined') return
    const canonical = getCanonicalOrigin()
    if (!canonical) return
    try {
      const canonicalHost = new URL(canonical).host
      if (window.location.host !== canonicalHost) {
        window.location.replace(
          `${canonical}${window.location.pathname}${window.location.search}`
        )
      }
    } catch {
      // URL parse失敗時は何もしない
    }
  }, [])

  const redBtnStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #e8001d, #b50017)',
    color: '#fff',
  }

  const handleGoogleAuth = async () => {
    setIsLoading(true)
    setError(null)
    setMessage(null)
    try {
      const supabase = createClient()
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${getCanonicalOrigin()}/callback`,
          scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
    } catch (err: unknown) {
      const authErr = err as { message?: string }
      setError(translateError(authErr.message))
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    const supabase = createClient()
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${getCanonicalOrigin()}/callback`,
          },
        })
        if (signUpError) throw signUpError
        if (!data.session) {
          setMessage('確認メールを送信しました。メールを確認してリンクをクリックしてください。')
          setIsLoading(false)
          return
        }
        window.location.href = '/dashboard'
        return
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) throw signInError
      if (signInData.user?.user_metadata?.needs_password_setup || signInData.user?.user_metadata?.needs_google_link) {
        window.location.href = '/setup-password'
        return
      }
      const next = searchParams.get('next') || '/dashboard'
      window.location.href = next
    } catch (err: unknown) {
      const authErr = err as { message?: string }
      setError(translateError(authErr.message))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8"
      style={{ fontFamily: JP_FONT }}
    >
      <div className="text-center mb-6">
        <div className="mx-auto mb-3 text-4xl">📋</div>
        <h1 className="text-2xl font-bold" style={{ color: '#b50017' }}>
          {APP_NAME}
        </h1>
        <p className="mt-1 text-sm text-slate-500">業務管理ポータル</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            mode === 'login'
              ? 'border-b-2 text-slate-900'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          style={mode === 'login' ? { borderBottomColor: '#e8001d' } : {}}
          onClick={() => {
            setMode('login')
            setError(null)
            setMessage(null)
          }}
        >
          ログイン
        </button>
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            mode === 'signup'
              ? 'border-b-2 text-slate-900'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          style={mode === 'signup' ? { borderBottomColor: '#e8001d' } : {}}
          onClick={() => {
            setMode('signup')
            setError(null)
            setMessage(null)
          }}
        >
          新規登録
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            placeholder={mode === 'signup' ? '6文字以上' : 'パスワードを入力'}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          style={redBtnStyle}
          className="w-full h-11 rounded-lg font-medium text-white shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60 inline-flex items-center justify-center"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? '処理中...' : mode === 'login' ? 'ログイン' : '新規登録'}
        </button>
      </form>

      {mode === 'login' && (
        <div className="text-center mt-3">
          <Link
            href="/forgot-password"
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            パスワードを忘れた方はこちら
          </Link>
        </div>
      )}

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-slate-400">または</span>
        </div>
      </div>

      {/* Google OAuth */}
      <button
        type="button"
        onClick={handleGoogleAuth}
        disabled={isLoading}
        className="w-full h-11 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 inline-flex items-center justify-center"
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
        Googleで{mode === 'login' ? 'ログイン' : '登録'}
      </button>

      <p className="text-xs text-center text-slate-400 mt-3">
        Googleカレンダー連携が自動的に有効になります
      </p>
    </div>
  )
}
