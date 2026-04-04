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
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { SHIFT_TYPE_LABELS, type ShiftType, SHIFT_TYPES } from '@/lib/validations/shift'
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
  projects,
  staffList,
  currentStaffId,
  isManager,
  onCreated,
}: ShiftCreateDialogProps) {
  const [staffId, setStaffId] = useState(currentStaffId || '')
  const [projectId, setProjectId] = useState('')
  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState(initialStartTime)
  const [endTime, setEndTime] = useState(initialEndTime)
  const [shiftType, setShiftType] = useState<ShiftType>('WORK')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setDate(initialDate)
    setStartTime(initialStartTime)
    setEndTime(initialEndTime)
  }, [initialDate, initialStartTime, initialEndTime])

  useEffect(() => {
    if (currentStaffId) setStaffId(currentStaffId)
  }, [currentStaffId])

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
          notes: notes || undefined,
          created_by: staffId,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'シフトの作成に失敗しました')
      }

      toast.success(isAutoApproval ? 'シフトを登録しました' : 'シフトを申請しました')
      onOpenChange(false)
      onCreated()
      // Reset
      setNotes('')
      setShiftType('WORK')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'シフトの作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
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
                  <SelectValue placeholder="スタッフを選択" />
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
                <SelectValue placeholder="プロジェクトを選択" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      {p.name}
                      <Badge variant="outline" className="text-[10px] py-0">
                        {p.shiftApprovalMode === 'AUTO' ? '自動承認' : '承認制'}
                      </Badge>
                    </div>
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
                <SelectValue />
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
