'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { AttendanceRecord } from '@/hooks/use-attendance'

/** ISO -> "YYYY-MM-DDTHH:mm" (JST, datetime-local input向け) */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 16)
}

/** "YYYY-MM-DDTHH:mm" (JST) -> ISO UTC */
function fromLocalInput(local: string): string | null {
  if (!local) return null
  const d = new Date(local + ':00+09:00')
  return d.toISOString()
}

export function CorrectionRequestDialog({
  record,
  open,
  onOpenChange,
  onSubmitted,
}: {
  record: AttendanceRecord | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmitted?: () => void
}) {
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [breakMin, setBreakMin] = useState<number>(0)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 開いた時に初期値セット
  if (record && open && clockIn === '' && reason === '') {
    setClockIn(toLocalInput(record.clock_in))
    setClockOut(toLocalInput(record.clock_out))
    setBreakMin(record.break_minutes || 0)
  }

  const reset = () => {
    setClockIn('')
    setClockOut('')
    setBreakMin(0)
    setReason('')
  }

  const handleClose = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

  const handleSubmit = async () => {
    if (!record) return
    if (!reason.trim()) {
      toast.error('修正理由を入力してください')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/attendance/correction-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendance_record_id: record.id,
          requested_clock_in: fromLocalInput(clockIn),
          requested_clock_out: fromLocalInput(clockOut),
          requested_break_minutes: breakMin,
          reason,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '申請に失敗しました')
      }
      toast.success('修正申請を送信しました')
      reset()
      onOpenChange(false)
      onSubmitted?.()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>打刻修正申請</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ci">出勤時刻</Label>
            <Input
              id="ci"
              type="datetime-local"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co">退勤時刻</Label>
            <Input
              id="co"
              type="datetime-local"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bm">休憩（分）</Label>
            <Input
              id="bm"
              type="number"
              min={0}
              value={breakMin}
              onChange={(e) => setBreakMin(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs">修正理由 *</Label>
            <Textarea
              id="rs"
              placeholder="例: 打刻忘れ、システム不具合など"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '送信中...' : '申請する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
