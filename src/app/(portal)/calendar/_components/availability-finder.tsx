'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Video } from 'lucide-react'
import { toast } from 'sonner'

interface AvailabilityCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedUserIds: string[]
  initialDate: string
  initialStartTime: string
  initialEndTime: string
  memberNames: Record<string, string>
}

export function AvailabilityCreateDialog({
  open,
  onOpenChange,
  selectedUserIds,
  initialDate,
  initialStartTime,
  initialEndTime,
  memberNames,
}: AvailabilityCreateDialogProps) {
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState(initialStartTime)
  const [endTime, setEndTime] = useState(initialEndTime)
  const [withMeet, setWithMeet] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ meetUrl: string } | null>(null)

  const handleCreate = async () => {
    if (!summary || !date || !startTime || !endTime) {
      toast.error('タイトル、日付、時刻は必須です')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: selectedUserIds,
          summary,
          description,
          start_datetime: `${date}T${startTime}:00+09:00`,
          end_datetime: `${date}T${endTime}:00+09:00`,
          with_meet: withMeet,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '予定の作成に失敗しました')
      }

      const data = await res.json()
      toast.success('予定を作成しました')
      setResult({ meetUrl: data.meetUrl || '' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '予定の作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const participantNames = selectedUserIds
    .map(id => memberNames[id] || id)
    .join('、')

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); setResult(null) }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>予定を作成</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 text-center py-4">
            <div className="text-green-600 text-lg font-medium">予定を作成しました</div>
            {result.meetUrl && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Google Meet リンク:</p>
                <div className="flex items-center gap-2 justify-center">
                  <Video className="h-4 w-4 text-blue-500" />
                  <a
                    href={result.meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {result.meetUrl}
                  </a>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(result.meetUrl)
                    toast.success('URLをコピーしました')
                  }}
                >
                  URLをコピー
                </Button>
              </div>
            )}
            <Button onClick={() => { onOpenChange(false); setResult(null) }}>
              閉じる
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              参加者: {participantNames}
            </div>

            <div className="space-y-1.5">
              <Label>タイトル</Label>
              <Input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="ミーティング名"
              />
            </div>

            <div className="space-y-1.5">
              <Label>日付</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>開始</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>終了</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>説明（任意）</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={withMeet}
                onChange={(e) => setWithMeet(e.target.checked)}
                className="rounded"
              />
              Google Meet リンクを生成
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? '作成中...' : '作成'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
