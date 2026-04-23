'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { SHIFT_TYPE_LABELS, type ShiftType, SHIFT_TYPES } from '@/lib/validations/shift'
import { AttendeePicker, type Attendee } from './attendee-picker'
import { toast } from 'sonner'

interface ProjectOption {
  id: string
  name: string
  shiftApprovalMode: 'AUTO' | 'APPROVAL'
}

interface StaffOption {
  id: string
  name: string
}

interface ShiftCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate: string
  initialStartTime: string
  initialEndTime: string
  /** フィルターで単一プロジェクトが選択されているときに自動プリフィルするID */
  initialProjectId?: string
  /** フィルターで単一スタッフが選択されているときに自動プリフィルするID (管理者のみ) */
  initialStaffId?: string
  projects: ProjectOption[]
  staffList: StaffOption[]
  currentStaffId?: string
  isManager: boolean
  onCreated: () => void
}

export function ShiftCreateDialog({
  open,
  onOpenChange,
  initialDate,
  initialStartTime,
  initialEndTime,
  initialProjectId,
  initialStaffId,
  projects,
  staffList,
  currentStaffId,
  isManager,
  onCreated,
}: ShiftCreateDialogProps) {
  const [staffId, setStaffId] = useState(initialStaffId || currentStaffId || '')
  const [projectId, setProjectId] = useState(initialProjectId || '')
  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState(initialStartTime)
  const [endTime, setEndTime] = useState(initialEndTime)
  const [shiftType, setShiftType] = useState<ShiftType>('WORK')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setDate(initialDate)
    setStartTime(initialStartTime)
    setEndTime(initialEndTime)
  }, [initialDate, initialStartTime, initialEndTime])

  // ダイアログが開くたびにフィルター由来の初期PJ/スタッフを再反映
  // (page側で filterProject/filterStaffIds が切り替わった直後に開かれても追従するように)
  useEffect(() => {
    if (!open) return
    if (initialProjectId) setProjectId(initialProjectId)
    if (initialStaffId) {
      setStaffId(initialStaffId)
    } else if (currentStaffId) {
      setStaffId(currentStaffId)
    }
    // open 時のワンショット反映。以降の手動変更はユーザー操作を優先。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (currentStaffId && !initialStaffId) setStaffId(currentStaffId)
  }, [currentStaffId, initialStaffId])

  const selectedProject = projects.find(p => p.id === projectId)
  const isAutoApproval = selectedProject?.shiftApprovalMode === 'AUTO'

  const handleSubmit = async () => {
    if (!staffId || !projectId || !date || !startTime || !endTime) {
      toast.error('必須項目を入力してください')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          project_id: projectId,
          shift_date: date,
          start_time: startTime,
          end_time: endTime,
          shift_type: shiftType,
          title: title || undefined,
          notes: notes || undefined,
          attendees,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'シフトの作成に失敗しました')
      }

      toast.success(isAutoApproval ? 'シフトを登録しました' : 'シフトを申請しました')
      // 即時リフェッチ（Realtimeに依存しない確実な反映）
      // fetchShiftsSafe が Promise を返すので await で完了を待つ
      try { await onCreated() } catch { /* noop */ }
      onOpenChange(false)
      // 念のため 500ms 後にもう一度（read-after-write 的な瞬間的遅延対策）
      setTimeout(() => { try { onCreated() } catch { /* noop */ } }, 500)
      // Reset
      setNotes('')
      setTitle('')
      setShiftType('WORK')
      setAttendees([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'シフトの作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>シフト{isAutoApproval ? '登録' : '申請'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* スタッフ選択 - 管理者は全員選べる */}
          {isManager ? (
            <div className="space-y-1.5">
              <Label>スタッフ</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger>
                  <SelectValueWithLabel
                    value={staffId}
                    labels={Object.fromEntries(staffList.map(s => [s.id, s.name]))}
                    placeholder="スタッフを選択"
                  />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <input type="hidden" value={staffId} />
          )}

          {/* プロジェクト選択 */}
          <div className="space-y-1.5">
            <Label>プロジェクト</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValueWithLabel
                  value={projectId}
                  labels={Object.fromEntries(projects.map(p => [p.id, p.name]))}
                  placeholder="プロジェクトを選択"
                />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {' '}
                    <span className="text-[10px] text-muted-foreground">
                      ({p.shiftApprovalMode === 'AUTO' ? '自動承認' : '承認制'})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProject && (
              <p className="text-xs text-muted-foreground">
                {isAutoApproval
                  ? '自動承認: 登録後すぐにシフトが確定します'
                  : '承認制: 管理者の承認後にシフトが確定します'}
              </p>
            )}
          </div>

          {/* タイトル */}
          <div className="space-y-1.5">
            <Label>タイトル（任意）</Label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 定例MTG"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">未入力の場合はプロジェクト名が表示されます</p>
          </div>

          {/* 日付 */}
          <div className="space-y-1.5">
            <Label>日付</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* 時間 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>開始時刻</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>終了時刻</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* シフト種別 */}
          <div className="space-y-1.5">
            <Label>種別</Label>
            <Select value={shiftType} onValueChange={(v) => setShiftType(v as ShiftType)}>
              <SelectTrigger>
                <SelectValueWithLabel
                  value={shiftType}
                  labels={SHIFT_TYPE_LABELS}
                />
              </SelectTrigger>
              <SelectContent>
                {SHIFT_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{SHIFT_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* メモ */}
          <div className="space-y-1.5">
            <Label>メモ（任意）</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="備考があれば入力"
              rows={2}
            />
          </div>

          {/* 招待者 */}
          <AttendeePicker value={attendees} onChange={setAttendees} />


          {/* 送信ボタン */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '処理中...' : isAutoApproval ? '登録' : '申請'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
