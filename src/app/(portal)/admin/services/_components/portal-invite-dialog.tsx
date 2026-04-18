'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, UserPlus } from 'lucide-react'

type Service = { id: string; slug: string; name: string; category: string | null }

export function PortalInviteDialog({ services }: { services: Service[] }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<'owner' | 'admin' | 'staff'>('staff')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const reset = () => {
    setEmail('')
    setDisplayName('')
    setRole('staff')
    setSelected(new Set())
    setError(null)
    setSuccess(null)
  }

  const toggleService = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)
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
      const emailSent = json.email_sent !== false
      setSuccess(
        emailSent
          ? `✉️ ${email} に招待メールを送信しました。\n付与サービス: ${json.granted_services}件\n初期パスワード: ${json.initial_password}`
          : `⚠️ アカウントは作成しましたがメール送信に失敗しました。\n初期パスワード: ${json.initial_password}（手動で共有してください）`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ネットワークエラー')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
        <UserPlus className="h-4 w-4 mr-1.5" />
        Canvi統合招待
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) reset()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Canvi統合招待</DialogTitle>
            <DialogDescription>
              ポータルアカウントを発行し、指定したサービスに一括でアクセス権を付与します。受信者には初回ログイン手順のメールが送信されます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 whitespace-pre-wrap">{error}</div>
            )}
            {success && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 whitespace-pre-wrap break-all">{success}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">メールアドレス <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">表示名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="山田 太郎"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ロール <span className="text-red-500">*</span></label>
              <Select value={role} onValueChange={(v) => setRole(v as 'owner' | 'admin' | 'staff')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">スタッフ</SelectItem>
                  <SelectItem value="admin">管理者</SelectItem>
                  <SelectItem value="owner">オーナー</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">付与するサービス</label>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50">
                {services.map((svc) => {
                  const checked = selected.has(svc.id)
                  return (
                    <label
                      key={svc.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer border text-sm ${
                        checked ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'
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
                        {svc.category && <div className="text-xs text-slate-500">{svc.category}</div>}
                      </div>
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1">{selected.size} 件選択中</p>
            </div>
            <p className="text-xs text-slate-500">
              ※ アカウント作成後、初期パスワード付きの招待メールが自動送信されます。受信者は初回ログイン時にパスワード再設定とGoogle連携を求められます。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset() }}>キャンセル</Button>
            {!success && (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {submitting ? '送信中...' : '招待する'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
