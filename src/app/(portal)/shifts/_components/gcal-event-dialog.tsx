'use client'

import { useState } from 'react'
import { Clock, Calendar, Video, Copy, MapPin, FileText, Trash2, Pencil, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export interface GCalEventItem {
  id: string
  summary: string
  start: string
  end: string
  description?: string
  location?: string
  meetUrl?: string | null
}

interface GCalEventDialogProps {
  event: GCalEventItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onTimeUpdate?: (eventId: string, startDateTime: string, endDateTime: string) => Promise<boolean>
  onDelete?: (eventId: string) => void
  onMeetCreate?: (eventId: string) => Promise<string | null>
  onMeetDelete?: (eventId: string) => Promise<boolean>
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/g
const URL_TEST = /^https?:\/\//

function renderWithLinks(text: string) {
  const parts = text.split(URL_REGEX)
  return parts.map((part, i) => {
    if (URL_TEST.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline [overflow-wrap:anywhere] break-all"
        >
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function stripHtmlKeepLinks(html: string): string {
  // <a href="X">label</a> → "label (X)" if different, else just X
  return html
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const cleanLabel = label.replace(/<[^>]+>/g, '').trim()
      if (!cleanLabel || cleanLabel === href) return href
      return `${cleanLabel} (${href})`
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

function parseDateTime(isoStr: string) {
  const d = new Date(isoStr)
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const weekday = WEEKDAY_LABELS[d.getDay()]
  const dateJP = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekday})`
  return { date, time, dateJP }
}

function calcDuration(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const diff = (eh * 60 + em) - (sh * 60 + sm)
  if (diff <= 0) return ''
  const hours = Math.floor(diff / 60)
  const mins = diff % 60
  return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`
}

export function GCalEventDialog({
  event,
  open,
  onOpenChange,
  onTimeUpdate,
  onDelete,
  onMeetCreate,
  onMeetDelete,
}: GCalEventDialogProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [meetLoading, setMeetLoading] = useState(false)
  const [currentMeetUrl, setCurrentMeetUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!event) return null

  const startParsed = parseDateTime(event.start)
  const endParsed = parseDateTime(event.end)
  const meetUrl = currentMeetUrl !== null ? (currentMeetUrl || null) : event.meetUrl || null

  const handleStartEdit = () => {
    setEditStartTime(startParsed.time)
    setEditEndTime(endParsed.time)
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!onTimeUpdate) return
    setSaving(true)
    try {
      const startDateTime = `${startParsed.date}T${editStartTime}:00+09:00`
      const endDateTime = `${startParsed.date}T${editEndTime}:00+09:00`
      const success = await onTimeUpdate(event.id, startDateTime, endDateTime)
      if (success) {
        setIsEditing(false)
        onOpenChange(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleMeetCreate = async () => {
    if (!onMeetCreate) return
    setMeetLoading(true)
    try {
      const url = await onMeetCreate(event.id)
      if (url) setCurrentMeetUrl(url)
    } finally {
      setMeetLoading(false)
    }
  }

  const handleMeetDelete = async () => {
    if (!onMeetDelete) return
    setMeetLoading(true)
    try {
      const success = await onMeetDelete(event.id)
      if (success) setCurrentMeetUrl('')
    } finally {
      setMeetLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); setIsEditing(false); setCurrentMeetUrl(null) }}>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2 min-w-0">
            <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
            <span className="truncate min-w-0 flex-1">{event.summary || '(予定)'}</span>
          </DialogTitle>
          <DialogDescription>
            Googleカレンダーの予定
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 min-w-0">
          {/* Google Calendar badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-50 border-blue-300 text-blue-700">
              <Calendar className="h-3.5 w-3.5" />
              Googleカレンダー
            </span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{startParsed.dateJP}</span>
          </div>

          {/* Time - editable */}
          {isEditing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <Label className="text-sm">時間</Label>
              </div>
              <div className="flex items-center gap-2 pl-7">
                <Input
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="w-[120px]"
                />
                <span className="text-muted-foreground">〜</span>
                <Input
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="w-[120px]"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{startParsed.time} 〜 {endParsed.time}</span>
              <span className="text-xs text-muted-foreground">
                ({calcDuration(startParsed.time, endParsed.time)})
              </span>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3 text-sm min-w-0">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-muted-foreground min-w-0 flex-1 [overflow-wrap:anywhere] break-all whitespace-pre-wrap">
                {renderWithLinks(event.location)}
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3 text-sm min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-muted-foreground whitespace-pre-wrap min-w-0 flex-1 [overflow-wrap:anywhere] break-all">
                {renderWithLinks(stripHtmlKeepLinks(event.description))}
              </div>
            </div>
          )}

          {/* Google Meet URL / 発行・削除 */}
          {meetUrl ? (
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-3 text-sm min-w-0">
                <Video className="h-4 w-4 text-blue-500 shrink-0" />
                <a
                  href={meetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium shrink-0"
                >
                  Google Meet に参加
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(meetUrl)
                    toast.success('URLをコピーしました')
                  }}
                  className="p-1 rounded hover:bg-muted shrink-0"
                  title="URLをコピー"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={handleMeetDelete}
                  disabled={meetLoading}
                  className="p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-600 shrink-0"
                  title="Meet URLを削除"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="pl-7 min-w-0">
                <span className="text-xs text-muted-foreground break-all select-all block">{meetUrl}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm">
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
          )}
        </div>

        <DialogFooter>
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                キャンセル
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </Button>
            </>
          ) : (
            <>
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    onDelete(event.id)
                    onOpenChange(false)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  削除
                </Button>
              )}
              <div className="flex-1" />
              {onTimeUpdate && (
                <Button variant="outline" size="sm" onClick={handleStartEdit}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  編集
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
