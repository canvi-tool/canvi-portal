'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ClipboardList } from 'lucide-react'

interface CorrectionRequest {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  reason: string
  original_clock_in: string | null
  original_clock_out: string | null
  original_break_minutes: number | null
  requested_clock_in: string | null
  requested_clock_out: string | null
  requested_break_minutes: number | null
  review_comment: string | null
  created_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requester?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  project?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attendance_record?: any
}

function fmtTime(s: string | null) {
  if (!s) return '-'
  return new Date(s).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })
}

function fmtDate(s: string | null) {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })
}

export function CorrectionRequestsSection({ onChanged }: { onChanged?: () => void }) {
  const [items, setItems] = useState<CorrectionRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/attendance/correction-requests?scope=manage&status=pending')
      if (!res.ok) throw new Error('取得失敗')
      const json = await res.json()
      setItems(json.data || [])
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleReview = async (id: string, action: 'approve' | 'reject', comment?: string) => {
    setProcessing(id)
    try {
      const res = await fetch(`/api/attendance/correction-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '処理に失敗しました')
      }
      toast.success(action === 'approve' ? '承認しました' : '差戻しました')
      setRejectingId(null)
      setRejectComment('')
      fetchItems()
      onChanged?.()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setProcessing(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          打刻修正 承認待ち
          {items.length > 0 && (
            <Badge className="ml-1 bg-orange-100 text-orange-700">{items.length}件</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">読み込み中...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            承認待ちの修正申請はありません
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">
                        {it.requester?.display_name || it.requester?.email || '-'}
                      </span>
                      {it.project && (
                        <Badge variant="outline" className="text-xs">
                          {it.project.project_code || it.project.name}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(it.attendance_record?.date || it.created_at)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                      <div>
                        出勤: <span className="font-mono">{fmtTime(it.original_clock_in)}</span>
                        {' → '}
                        <span className="font-mono text-foreground">{fmtTime(it.requested_clock_in)}</span>
                      </div>
                      <div>
                        退勤: <span className="font-mono">{fmtTime(it.original_clock_out)}</span>
                        {' → '}
                        <span className="font-mono text-foreground">{fmtTime(it.requested_clock_out)}</span>
                      </div>
                      <div>
                        休憩: <span className="font-mono">{it.original_break_minutes ?? 0}分</span>
                        {' → '}
                        <span className="font-mono text-foreground">{it.requested_break_minutes ?? 0}分</span>
                      </div>
                      <div className="pt-1">理由: {it.reason}</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleReview(it.id, 'approve')}
                      disabled={processing === it.id || rejectingId === it.id}
                    >
                      承認
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectingId(it.id)}
                      disabled={processing === it.id}
                    >
                      差戻し
                    </Button>
                  </div>
                </div>
                {rejectingId === it.id && (
                  <div className="space-y-2 pt-2 border-t">
                    <Textarea
                      placeholder="差戻し理由を入力してください"
                      value={rejectComment}
                      onChange={(e) => setRejectComment(e.target.value)}
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setRejectingId(null); setRejectComment('') }}
                        disabled={processing === it.id}
                      >
                        キャンセル
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (!rejectComment.trim()) {
                            toast.error('差戻しコメントを入力してください')
                            return
                          }
                          handleReview(it.id, 'reject', rejectComment)
                        }}
                        disabled={processing === it.id}
                      >
                        差戻し送信
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
