'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Check, X, Paperclip } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

interface ChangeRequest {
  id: string
  staff_id: string
  requested_by: string
  changes: Record<string, { from: unknown; to: unknown }>
  attachment_urls: string[]
  requires_identity_doc: boolean
  requires_address_doc: boolean
  requires_bank_holder_doc: boolean
  status: string
  created_at: string
  staff?: { id: string; last_name: string; first_name: string } | null
  requester?: { id: string; display_name: string | null; email: string | null } | null
}

const FIELD_LABELS: Record<string, string> = {
  last_name: '姓', first_name: '名',
  last_name_kana: '姓（カナ）', first_name_kana: '名（カナ）',
  last_name_eiji: '姓（英字）', first_name_eiji: '名（英字）',
  email: 'メール', personal_email: '個人メール', phone: '電話',
  date_of_birth: '生年月日', postal_code: '郵便番号',
  prefecture: '都道府県', city: '市区町村',
  address_line1: '住所', address_line2: '建物名',
  bank_name: '銀行名', bank_branch: '支店名',
  bank_account_type: '口座種別', bank_account_number: '口座番号',
  bank_account_holder: '口座名義',
  emergency_contact_name: '緊急連絡先氏名',
  emergency_contact_phone: '緊急連絡先電話',
  emergency_contact_relation: '緊急連絡先続柄',
  notes: '備考',
}

export default function ProfileApprovalsPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/profile-change-requests?status=PENDING')
      if (!res.ok) throw new Error('取得に失敗しました')
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '取得失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function approve(id: string) {
    setBusy(id)
    try {
      const res = await fetch(`/api/profile-change-requests/${id}/approve`, { method: 'POST' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || '承認失敗')
      }
      toast.success('承認しました')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '承認失敗')
    } finally {
      setBusy(null)
    }
  }

  async function reject(id: string) {
    setBusy(id)
    try {
      const res = await fetch(`/api/profile-change-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: rejectComment[id] || '' }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || '却下失敗')
      }
      toast.success('却下しました')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '却下失敗')
    } finally {
      setBusy(null)
    }
  }

  async function viewAttachment(path: string) {
    try {
      const res = await fetch(`/api/profile-change-requests/attachment?path=${encodeURIComponent(path)}`)
      if (!res.ok) throw new Error('URL取得失敗')
      const { url } = await res.json()
      window.open(url, '_blank')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '閲覧失敗')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="プロフィール変更申請" description="スタッフからの変更申請を承認/却下します" />

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : requests.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">申請はありません</p>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => {
            const changeEntries = Object.entries(r.changes || {})
            const staffName = r.staff ? `${r.staff.last_name} ${r.staff.first_name}` : '不明'
            const requesterName = r.requester?.display_name || r.requester?.email || '不明'
            return (
              <Card key={r.id}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{staffName}</div>
                      <div className="text-xs text-muted-foreground">
                        申請者: {requesterName} / {new Date(r.created_at).toLocaleString('ja-JP')}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {r.requires_identity_doc && <Badge variant="outline">本人確認</Badge>}
                      {r.requires_address_doc && <Badge variant="outline">住所確認</Badge>}
                      {r.requires_bank_holder_doc && <Badge variant="outline">口座名義</Badge>}
                    </div>
                  </div>

                  <div className="rounded-md border divide-y">
                    {changeEntries.map(([k, v]) => (
                      <div key={k} className="px-3 py-2 text-sm">
                        <div className="text-muted-foreground text-xs mb-0.5">{FIELD_LABELS[k] || k}</div>
                        <div className="flex items-center gap-2">
                          <span className="line-through text-red-500/70">{String(v.from ?? '')}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium text-emerald-700">{String(v.to ?? '')}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {r.attachment_urls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {r.attachment_urls.map((p, i) => (
                        <Button key={p} variant="outline" size="sm" onClick={() => viewAttachment(p)}>
                          <Paperclip className="h-3 w-3 mr-1" /> 添付 {i + 1}
                        </Button>
                      ))}
                    </div>
                  )}

                  <Textarea
                    placeholder="却下コメント（任意）"
                    value={rejectComment[r.id] || ''}
                    onChange={(e) => setRejectComment((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    rows={2}
                    className="text-sm"
                  />

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reject(r.id)}
                      disabled={busy === r.id}
                    >
                      <X className="h-4 w-4 mr-1" /> 却下
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => approve(r.id)}
                      disabled={busy === r.id}
                    >
                      {busy === r.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                      承認して反映
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
