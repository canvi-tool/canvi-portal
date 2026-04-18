'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, UserPlus, CheckCircle2 } from 'lucide-react'

type Service = { id: string; slug: string; name: string; category: string | null }

export function InviteUserForm({ services }: { services: Service[] }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<'owner' | 'admin' | 'staff'>('staff')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [autoGrantAll, setAutoGrantAll] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<null | {
    email: string
    initialPassword: string
    grantedServices: number
    emailSent: boolean
  }>(null)

  const grouped = useMemo(() => {
    const map = new Map<string, Service[]>()
    for (const s of services) {
      const key = s.category ?? 'その他'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return Array.from(map.entries())
  }, [services])

  const toggleService = (id: string) => {
    setAutoGrantAll(false)
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleAutoGrantAll = (checked: boolean) => {
    setAutoGrantAll(checked)
    if (checked) setSelected(new Set(services.map((s) => s.id)))
    else setSelected(new Set())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email || !displayName) {
      setError('メールアドレスと氏名は必須です。')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/portal-invites', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          display_name: displayName,
          role,
          service_ids: Array.from(selected),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.message_ja || json.error || `招待に失敗しました (${res.status})`)
        return
      }
      setResult({
        email: json.email,
        initialPassword: json.initial_password,
        grantedServices: json.granted_services,
        emailSent: json.email_sent !== false,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ネットワークエラー')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-2xl rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 mt-0.5" />
          <div className="flex-1 space-y-3">
            <h2 className="text-lg font-semibold text-emerald-900">招待を完了しました</h2>
            {result.emailSent ? (
              <p className="text-sm text-emerald-800">
                {result.email} に招待メールを送信しました。受信者は初回ログイン時にパスワード再設定とGoogle連携を求められます。
              </p>
            ) : (
              <p className="text-sm text-amber-800">
                アカウントは作成しましたが、メール送信に失敗しました。下記の初期パスワードを受信者に手動で共有してください。
              </p>
            )}
            <div className="rounded-md bg-white border border-emerald-200 p-3 text-sm space-y-1">
              <div><span className="font-medium text-slate-700">メール:</span> {result.email}</div>
              <div><span className="font-medium text-slate-700">初期パスワード:</span> <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-900">{result.initialPassword}</code></div>
              <div><span className="font-medium text-slate-700">付与サービス数:</span> {result.grantedServices} 件</div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => router.push('/admin/services')} className="bg-indigo-600 hover:bg-indigo-700">
                サービス付与管理へ
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null)
                  setEmail('')
                  setDisplayName('')
                  setRole('staff')
                  setSelected(new Set())
                  setAutoGrantAll(false)
                }}
              >
                続けて別のユーザーを招待
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isPrivileged = role === 'owner' || role === 'admin'

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6 rounded-lg border border-slate-200 bg-white p-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            氏名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            placeholder="山田 太郎"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          ロール <span className="text-red-500">*</span>
        </label>
        <Select value={role} onValueChange={(v) => setRole(v as 'owner' | 'admin' | 'staff')}>
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="staff">スタッフ（メンバー）</SelectItem>
            <SelectItem value="admin">管理者</SelectItem>
            <SelectItem value="owner">オーナー</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">付与するサービス</label>
          <span className="text-xs text-slate-500">{selected.size} / {services.length} 件選択中</span>
        </div>

        {isPrivileged && (
          <label className="flex items-center gap-2 mb-2 p-2 rounded border border-indigo-200 bg-indigo-50 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={autoGrantAll}
              onChange={(e) => handleAutoGrantAll(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-indigo-900">
              オーナー/管理者のため全サービスを一括で付与する
            </span>
          </label>
        )}

        <div className="max-h-96 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3 space-y-4">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <div className="text-xs font-semibold uppercase text-slate-500 mb-1.5">{category}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map((svc) => {
                  const checked = selected.has(svc.id)
                  return (
                    <label
                      key={svc.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer border text-sm transition-colors ${
                        checked
                          ? 'bg-indigo-50 border-indigo-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleService(svc.id)}
                        className="rounded border-slate-300"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{svc.name}</div>
                        <div className="text-xs text-slate-500 truncate">{svc.slug}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-4">
              利用可能なサービスがありません。
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
        <p>※ アカウント作成と同時に初期パスワード付きの招待メールが送信されます。</p>
        <p>※ 受信者は初回ログイン時にパスワード再設定とGoogle連携が必要です。</p>
        <p>※ 付与されたサービスは「マイサービス」ページからアクセス可能になります。</p>
      </div>

      <div className="flex gap-3 pt-2 border-t border-slate-200">
        <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4 mr-2" />
          )}
          {submitting ? '招待中...' : '招待を送信'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/services')}>
          キャンセル
        </Button>
      </div>
    </form>
  )
}
