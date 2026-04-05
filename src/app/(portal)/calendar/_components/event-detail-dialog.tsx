'use client'

import { useState, useEffect } from 'react'
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
import { Pencil, Trash2, Clock, User, MapPin, Video, Copy, XCircle } from 'lucide-react'
import { toast } from 'sonner'

export interface CalendarEventData {
  eventId: string
  summary: string
  description?: string
  location?: string
  date: string
  startTime: string
  endTime: string
  source: 'google' | 'shift'
  memberName: string
  memberId: string
}

interface EventDetailDialogProps {
  event: CalendarEventData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}

export function EventDetailDialog({
  event,
  open,
  onOpenChange,
  onUpdated,
}: EventDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [meetLoading, setMeetLoading] = useState(false)
  const [meetUrl, setMeetUrl] = useState<string | null>(null)

  useEffect(() => {
    if (event && open) {
      setSummary(event.summary || '')
      setDescription(event.description || '')
      setDate(event.date)
      setStartTime(event.startTime)
      setEndTime(event.endTime)
      setIsEditing(false)
      setMeetUrl(null)
    }
  }, [event, open])

  if (!event) return null

  const isGoogleEvent = event.source === 'google' && !!event.eventId

  const handleMeetCreate = async () => {
    if (!isGoogleEvent) return
    setMeetLoading(true)
    try {
      const res = await fetch(`/api/calendar/events/${event.eventId}/meet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start_datetime: `${event.date}T${event.startTime}:00+09:00`,
          end_datetime: `${event.date}T${event.endTime}:00+09:00`,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Meet URLの発行に失敗しました')
      }
      const data = await res.json()
      setMeetUrl(data.meetUrl)
      toast.success('Google Meet URLを発行しました')
      onUpdated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Meet URLの発行に失敗しました')
    } finally {
      setMeetLoading(false)
    }
  }

  const handleMeetDelete = async () => {
    if (!isGoogleEvent) return
    setMeetLoading(true)
    try {
      const res = await fetch(`/api/calendar/events/${event.eventId}/meet`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start_datetime: `${event.date}T${event.startTime}:00+09:00`,
          end_datetime: `${event.date}T${event.endTime}:00+09:00`,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Meet URLの削除に失敗しました')
      }
      setMeetUrl('')
      toast.success('Google Meet URLを削除しました')
      onUpdated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Meet URLの削除に失敗しました')
    } finally {
      setMeetLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!summary || !date || !startTime || !endTime) {
      toast.error('タイトル、日付、時刻は必須です')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/calendar/events/${event.eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          description: description || undefined,
          start_datetime: `${date}T${startTime}:00+09:00`,
          end_datetime: `${date}T${endTime}:00+09:00`,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '予定の更新に失敗しました')
      }

      toast.success('予定を更新しました')
      setIsEditing(false)
      onUpdated?.()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '予定の更新に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('この予定を削除しますか？')) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/calendar/events/${event.eventId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '予定の削除に失敗しました')
      }

      toast.success('予定を削除しました')
      onUpdated?.()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '予定の削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span>{isEditing ? '予定を編集' : '予定の詳細'}</span>
            {isGoogleEvent && !isEditing && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>タイトル</Label>
              <Input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="予定名"
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
              <Label>説明</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={submitting}>
                キャンセル
              </Button>
              <Button onClick={handleUpdate} disabled={submitting}>
                {submitting ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* タイトル */}
            <div>
              <h3 className="text-lg font-semibold">{event.summary || '(タイトルなし)'}</h3>
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {event.source === 'google' ? 'Google Calendar' : 'シフト'}
              </span>
            </div>

            {/* 日時 */}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{event.date} {event.startTime} - {event.endTime}</span>
            </div>

            {/* メンバー */}
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{event.memberName}</span>
            </div>

            {/* 場所 */}
            {event.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{event.location}</span>
              </div>
            )}

            {/* Google Meet URL */}
            {isGoogleEvent && (
              meetUrl ? (
                <div className="flex items-center gap-2 text-sm">
                  <Video className="h-4 w-4 text-blue-500 shrink-0" />
                  <a
                    href={meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline truncate"
                  >
                    Google Meet に参加
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(meetUrl)
                      toast.success('URLをコピーしました')
                    }}
                    className="p-1 rounded hover:bg-muted"
                    title="URLをコピー"
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={handleMeetDelete}
                    disabled={meetLoading}
                    className="p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-600"
                    title="Meet URLを削除"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <Video className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleMeetCreate}
                    disabled={meetLoading}
                  >
                    {meetLoading ? '発行中...' : 'Google Meet URLを発行'}
                  </Button>
                </div>
              )
            )}

            {/* 説明 */}
            {event.description && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                {event.description}
              </div>
            )}

            {/* シフトの場合は編集不可の案内 */}
            {event.source === 'shift' && (
              <p className="text-xs text-muted-foreground">
                シフトの編集・削除は「シフト管理」画面から行えます。
              </p>
            )}

            {!isGoogleEvent && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  閉じる
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
