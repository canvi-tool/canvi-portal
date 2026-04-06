'use client'

import { useState, useEffect } from 'react'
import { Clock, User, Briefcase, Calendar, Pencil, Trash2, CheckCircle2, XCircle, Send, Video, Copy } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type ShiftStatus = 'SUBMITTED' | 'APPROVED' | 'NEEDS_REVISION'

interface ProjectOption {
  id: string
  name: string
}

interface ShiftItem {
  id: string
  staffId: string
  staffName: string
  projectId: string
  projectName: string
  date: string
  startTime: string
  endTime: string
  status: ShiftStatus
  notes?: string
  googleMeetUrl?: string | null
  googleCalendarSynced?: boolean
}

interface ShiftEditDialogProps {
  shift: ShiftItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: (shift: ShiftItem) => void
  onDelete?: (shiftId: string) => void
  onApprove?: (shiftId: string) => void
  onReject?: (shiftId: string) => void
  onSyncCalendar?: (shiftId: string) => void
  isManager?: boolean
  projects?: ProjectOption[]
}

const STATUS_CONFIG: Record<ShiftStatus, { label: string; color: string; bgColor: string; icon: typeof CheckCircle2 }> = {
  SUBMITTED: { label: '申請中', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-300', icon: Send },
  APPROVED: { label: '承認済', color: 'text-green-700', bgColor: 'bg-green-50 border-green-300', icon: CheckCircle2 },
  NEEDS_REVISION: { label: '修正依頼', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-300', icon: Pencil },
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAY_LABELS[d.getDay()]})`
}

export function ShiftEditDialog({
  shift,
  open,
  onOpenChange,
  onSave,
  onDelete,
  onApprove,
  onReject,
  onSyncCalendar,
  isManager = false,
  projects = [],
}: ShiftEditDialogProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editProjectId, setEditProjectId] = useState('')
  const [meetLoading, setMeetLoading] = useState(false)
  const [currentMeetUrl, setCurrentMeetUrl] = useState<string | null>(null)

  // ダイアログが開くたびにリセット
  useEffect(() => {
    if (open) setCurrentMeetUrl(null)
  }, [open])

  // Meet URL状態をshift propから同期
  const meetUrl = currentMeetUrl !== null ? currentMeetUrl : shift?.googleMeetUrl || null

  if (!shift) return null

  const handleMeetCreate = async () => {
    setMeetLoading(true)
    try {
      const res = await fetch(`/api/shifts/${shift.id}/meet`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Meet URLの発行に失敗しました')
      }
      const data = await res.json()
      setCurrentMeetUrl(data.meetUrl)
      toast.success('Google Meet URLを発行しました')
      onSyncCalendar?.(shift.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Meet URLの発行に失敗しました')
    } finally {
      setMeetLoading(false)
    }
  }

  const handleMeetDelete = async () => {
    setMeetLoading(true)
    try {
      const res = await fetch(`/api/shifts/${shift.id}/meet`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Meet URLの削除に失敗しました')
      }
      setCurrentMeetUrl('')
      toast.success('Google Meet URLを削除しました')
      onSyncCalendar?.(shift.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Meet URLの削除に失敗しました')
    } finally {
      setMeetLoading(false)
    }
  }

  const statusConfig = STATUS_CONFIG[shift.status]
  const StatusIcon = statusConfig.icon
  const canEdit = isManager || shift.status === 'NEEDS_REVISION' || shift.status === 'SUBMITTED'
  const canApprove = shift.status === 'SUBMITTED'

  // gcal: プレフィックスは内部用なので表示時は除外
  const cleanNotes = (shift.notes || '').startsWith('gcal:') ? '' : (shift.notes || '')

  const handleStartEdit = () => {
    setEditStartTime(shift.startTime)
    setEditEndTime(shift.endTime)
    setEditNotes(cleanNotes)
    setEditProjectId(shift.projectId)
    setIsEditing(true)
  }

  const selectedProject = projects.find(p => p.id === editProjectId)

  const handleSave = () => {
    if (onSave) {
      onSave({
        ...shift,
        startTime: editStartTime,
        endTime: editEndTime,
        notes: editNotes,
        projectId: editProjectId,
        projectName: selectedProject?.name || shift.projectName,
      })
    }
    setIsEditing(false)
    onOpenChange(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); setIsEditing(false) }}>
      <DialogContent className="sm:max-w-md overflow-hidden max-w-[calc(100vw-2rem)]">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2 min-w-0">
            <Briefcase className="h-4 w-4 shrink-0" />
            <span className="truncate min-w-0 flex-1">{shift.projectName}</span>
          </DialogTitle>
          <DialogDescription>
            シフト詳細 {canEdit && '(編集可能)'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 min-w-0">
          {/* Source + Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-orange-50 border-orange-300 text-orange-700">
              <Calendar className="h-3.5 w-3.5" />
              Canviカレンダー
            </span>
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
              statusConfig.bgColor, statusConfig.color
            )}>
              <StatusIcon className="h-3.5 w-3.5" />
              {statusConfig.label}
            </span>
          </div>

          {/* Project - editable */}
          {isEditing && projects.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                <Label className="text-sm">プロジェクト</Label>
              </div>
              <div className="pl-7">
                <Select value={editProjectId} onValueChange={setEditProjectId}>
                  <SelectTrigger className="w-full">
                    <SelectValueWithLabel
                      value={editProjectId}
                      labels={Object.fromEntries(projects.map(p => [p.id, p.name]))}
                      placeholder="プロジェクトを選択"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {/* Staff info */}
          <div className="flex items-center gap-3 text-sm">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium">{shift.staffName}</span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{formatDateJP(shift.date)}</span>
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
              <span>{shift.startTime} 〜 {shift.endTime}</span>
              <span className="text-xs text-muted-foreground">
                ({(() => {
                  const [sh, sm] = shift.startTime.split(':').map(Number)
                  const [eh, em] = shift.endTime.split(':').map(Number)
                  const diff = (eh * 60 + em) - (sh * 60 + sm)
                  const hours = Math.floor(diff / 60)
                  const mins = diff % 60
                  return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`
                })()})
              </span>
            </div>
          )}

          {/* Notes - editable */}
          {isEditing ? (
            <div className="space-y-2">
              <Label className="text-sm pl-7">説明</Label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="説明を入力..."
                className="w-full ml-7 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={2}
                style={{ width: 'calc(100% - 28px)' }}
              />
            </div>
          ) : cleanNotes ? (
            <div className="flex items-start gap-3 text-sm min-w-0">
              <Pencil className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-muted-foreground whitespace-pre-wrap min-w-0 flex-1 [overflow-wrap:anywhere] break-all line-clamp-4">{cleanNotes}</span>
            </div>
          ) : null}

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
                <span className="text-xs text-muted-foreground break-all select-all line-clamp-2 block">{meetUrl}</span>
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
              <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                キャンセル
              </Button>
              <Button size="sm" onClick={handleSave}>
                保存
              </Button>
            </>
          ) : (
            <>
              {onDelete && canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    onDelete(shift.id)
                    onOpenChange(false)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  削除
                </Button>
              )}
              <div className="flex-1" />
              {canApprove && onReject && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => {
                    onReject(shift.id)
                    onOpenChange(false)
                  }}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  却下
                </Button>
              )}
              {canApprove && onApprove && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    onApprove(shift.id)
                    onOpenChange(false)
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  承認
                </Button>
              )}
              {canEdit && (
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
