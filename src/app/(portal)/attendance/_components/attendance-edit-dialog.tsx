'use client'

import { useEffect, useState } from 'react'
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

interface EditableRecord {
  id: string
  clock_in?: string | null
  clock_out?: string | null
  break_minutes?: number | null
}

/**
 * 管理者向け 直接編集ダイアログ。
 * PUT /api/attendance/:id { action: 'modify' } を叩く（申請ではなく即時修正）。
 */
export function AttendanceEditDialog({
  record,
  open,
  onOpenChange,
  onSaved,
}: {
  record: EditableRecord | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved?: () => void
}) {
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [breakMin, setBreakMin] = useState<number>(0)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && record) {
      setClockIn(toLocalInput(record.clock_in))
      setClockOut(toLocalInput(record.clock_out))
      setBreakMin(record.break_minutes || 0)
      setReason('')
    }
  }, [open, record])

  const handleSubmit = async () => {
    if (!record) return
    if (!reason.trim()) {
      toast.error('修正理由を入力してください')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/attendance/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'modify',
          clock_in: fromLocalInput(clockIn),
          clock_out: fromLocalInput(clockOut),
          break_minutes: breakMin,
          modification_reason: reason,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '修正に失敗しました')
      }
      toast.success('打刻を修正しました')
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>打刻を直接修正（管理者）</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="aci">出勤時刻</Label>
            <Input id="aci" type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aco">退勤時刻</Label>
            <Input id="aco" type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="abm">休憩（分）</Label>
            <Input id="abm" type="number" min={0} value={breakMin} onChange={(e) => setBreakMin(parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ars">修正理由 *</Label>
            <Textarea id="ars" placeholder="例: 打刻漏れを管理者修正" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
