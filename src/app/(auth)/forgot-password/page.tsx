'use client'

import { useState } from 'react'
import Link from 'next/link'
import { APP_NAME, getCanonicalOrigin } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ArrowLeft } from 'lucide-react'

const JP_FONT = "'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif"

function translateError(msg: string | undefined): string {
  if (!msg) return 'エラーが発生しました'
  const m = msg.toLowerCase()
  if (m.includes('user not found')) return '該当するアカウントが見つかりません'
  if (m.includes('invalid email')) return 'メールアドレスの形式が正しくありません'
  return msg
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getCanonicalOrigin()}/reset-password`,
      })
      if (resetErr) throw resetErr
      setSuccess(true)
    } catch (err: unknown) {
      const authErr = err as { message?: string }
      setError(translateError(authErr.message))
    } finally {
      setIsLoading(false)
    }
  }

  const redBtnStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #e8001d, #b50017)',
    color: '#fff',
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
        <p className="mt-1 text-sm text-slate-500">パスワードリセット</p>
      </div>

      {success ? (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
            パスワードリセットメールを送信しました。メールをご確認ください。
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full h-11 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            ログイン画面に戻る
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}
          <p className="text-sm text-slate-600 mb-4">
            登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
          </p>
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
            <button
              type="submit"
              disabled={isLoading}
              style={redBtnStyle}
              className="w-full h-11 rounded-lg font-medium text-white shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60 inline-flex items-center justify-center"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? '送信中...' : 'リセットメールを送信'}
            </button>
          </form>
          <div className="text-center mt-4">
            <Link
              href="/login"
              className="inline-flex items-center text-xs text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              ログイン画面に戻る
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
