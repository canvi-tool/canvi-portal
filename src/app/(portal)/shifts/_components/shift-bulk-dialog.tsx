'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
import { CalendarPlus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { isJpHoliday } from '@/lib/jp-holidays'

interface ProjectOption {
  id: string
  name: string
  shiftApprovalMode: 'AUTO' | 'APPROVAL'
}

interface StaffOption {
  id: string
  name: string
}

interface ShiftBulkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: ProjectOption[]
  staffList: StaffOption[]
  currentStaffId?: string
  isManager: boolean
  userRoles: string[]
  onCreated: () => void
  prefill?: {
    staffId?: string
    projectId?: string
    startTime?: string
    endTime?: string
    shiftType?: ShiftType
    notes?: string
    attendees?: Attendee[]
    title?: string
    /** 空き枠検索から予定を抑える時: 個別スロットを直接 entries として送信 */
    slotEntries?: Array<{ date: string; startTime: string; endTime: string }>
  } | null
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const
// 月曜始まり表示用: 各セルが表す JS getDay() の値
const WEEK_ORDER_MON_FIRST = [1, 2, 3, 4, 5, 6, 0] as const
const WEEK_LABELS_MON_FIRST = ['月', '火', '水', '木', '金', '土', '日'] as const

function formatDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function formatDateJP(dateStr: string): string {
  const [yr, mo, da] = dateStr.split('-').map(Number)
  const dt = new Date(yr, mo - 1, da)
  return `${mo}/${da}(${DAY_LABELS[dt.getDay()]})`
}

// ミニカレンダー用ヘルパー
function getCalendarDays(year: number, month: number) {
  const firstDayJs = new Date(year, month, 1).getDay()
  // 月曜始まり: 月=0, 火=1, ... 日=6
  const firstDay = (firstDayJs + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days: Array<{ date: string; day: number; inMonth: boolean }> = []

  // 前月の余白
  for (let i = 0; i < firstDay; i++) {
    days.push({ date: '', day: 0, inMonth: false })
  }
  // 当月
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: formatDateStr(year, month, d), day: d, inMonth: true })
  }
  return days
}

export function ShiftBulkDialog({
  open,
  onOpenChange,
  projects,
  staffList,
  currentStaffId,
  isManager,
  userRoles,
  onCreated,
  prefill,
}: ShiftBulkDialogProps) {
  const isOwner = userRoles.includes('owner')

  // スタッフ: 自分自身のみ。管理者/オーナーは選択可能
  const [staffId, setStaffId] = useState(currentStaffId || '')
  const [myStaffName, setMyStaffName] = useState<string>('')

  // 自分のスタッフ名を取得（staffListに自分が含まれない場合のフォールバック）
  useEffect(() => {
    if (!open || isManager || isOwner) return
    fetch('/api/staff/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.last_name || d?.first_name) {
          setMyStaffName(`${d.last_name || ''} ${d.first_name || ''}`.trim())
        }
        if (d?.id && !staffId) setStaffId(d.id)
      })
      .catch(() => {})
  }, [open, isManager, isOwner, staffId])
  const [projectId, setProjectId] = useState('')
  const [shiftType, setShiftType] = useState<ShiftType>('WORK')
  const [notes, setNotes] = useState('')
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [submitting, setSubmitting] = useState(false)

  // 日付選択
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [timeOverrides, setTimeOverrides] = useState<Record<string, { start: string; end: string }>>({})

  // ミニカレンダー表示月
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  // 曜日一括選択用
  const [quickDays, setQuickDays] = useState<boolean[]>([false, false, false, false, false, false, false])

  // プロジェクトに紐づくスタッフリスト
  const [projectStaff, setProjectStaff] = useState<StaffOption[]>([])

  useEffect(() => {
    if (!currentStaffId) return
    setStaffId(currentStaffId)
  }, [currentStaffId])

  const [slotEntries, setSlotEntries] = useState<Array<{ date: string; startTime: string; endTime: string }>>([])

  // prefill適用（複製時 / 空き枠予約時）: ダイアログが開いたときに初期値セット
  useEffect(() => {
    if (!open || !prefill) return
    if (prefill.staffId) setStaffId(prefill.staffId)
    if (prefill.projectId) setProjectId(prefill.projectId)
    if (prefill.startTime) setStartTime(prefill.startTime)
    if (prefill.endTime) setEndTime(prefill.endTime)
    if (prefill.shiftType) setShiftType(prefill.shiftType)
    if (prefill.notes !== undefined) setNotes(prefill.notes)
    if (prefill.title !== undefined) setTitle(prefill.title)
    if (prefill.attendees) setAttendees(prefill.attendees)
    if (prefill.slotEntries && prefill.slotEntries.length > 0) {
      setSlotEntries(prefill.slotEntries)
      // カレンダー側にも日付だけは反映（表示用）
      setSelectedDates(new Set(prefill.slotEntries.map((e) => e.date)))
    } else {
      setSlotEntries([])
    }
  }, [open, prefill])

  // プロジェクト選択時、アサインされたスタッフを取得（管理者用）
  useEffect(() => {
    if (!projectId || !isManager) {
      setProjectStaff([])
      return
    }
    fetch(`/api/projects/${projectId}/assignments`)
      .then(r => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list: StaffOption[] = data.map((a: any) => ({
          id: a.staff?.id || a.staff_id,
          name: `${a.staff?.last_name || ''} ${a.staff?.first_name || ''}`.trim(),
        })).filter((s: StaffOption) => s.id && s.name)
        setProjectStaff(list)
      })
      .catch(() => setProjectStaff([]))
  }, [projectId, isManager])

  // スタッフ選択肢: オーナー → 全員、管理者 → PJアサインスタッフ、スタッフ → 自分のみ
  const availableStaff = useMemo(() => {
    if (isOwner) return staffList
    if (isManager && projectStaff.length > 0) return projectStaff
    if (isManager) return staffList
    // スタッフは自分のみ
    return staffList.filter(s => s.id === currentStaffId)
  }, [isOwner, isManager, staffList, projectStaff, currentStaffId])

  const selectedProject = projects.find(p => p.id === projectId)
  const isAutoApproval = selectedProject?.shiftApprovalMode === 'AUTO'

  const calDays = useMemo(() => getCalendarDays(calYear, calMonth), [calYear, calMonth])

  const toggleDate = useCallback((date: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }, [])

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  // 曜日パターンで一括追加
  const applyDayPattern = useCallback(() => {
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const newDates = new Set(selectedDates)
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(calYear, calMonth, d)
      const dayOfWeek = dt.getDay()
      const dateStr = formatDateStr(calYear, calMonth, d)
      if (quickDays[dayOfWeek]) {
        newDates.add(dateStr)
      }
    }
    setSelectedDates(newDates)
  }, [calYear, calMonth, quickDays, selectedDates])

  const clearDates = () => {
    setSelectedDates(new Set())
    setTimeOverrides({})
  }

  const sortedDates = useMemo(
    () => Array.from(selectedDates).sort(),
    [selectedDates]
  )

  const removeDate = (date: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev)
      next.delete(date)
      return next
    })
    setTimeOverrides(prev => {
      const next = { ...prev }
      delete next[date]
      return next
    })
  }

  const handleSubmit = async () => {
    if (!staffId || !projectId) {
      toast.error('スタッフとプロジェクトを選択してください')
      return
    }
    const useSlotEntries = slotEntries.length > 0
    if (!useSlotEntries && sortedDates.length === 0) {
      toast.error('申請する日程がありません')
      return
    }
    if (!useSlotEntries && startTime >= endTime) {
      toast.error('終了時刻は開始時刻より後にしてください')
      return
    }

    setSubmitting(true)
    try {
      const entries = useSlotEntries
        ? slotEntries
            .slice()
            .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
            .map((s) => ({
              shift_date: s.date,
              start_time: s.startTime,
              end_time: s.endTime,
            }))
        : sortedDates.map((date) => {
            const override = timeOverrides[date]
            return {
              shift_date: date,
              start_time: override?.start || startTime,
              end_time: override?.end || endTime,
            }
          })

      const res = await fetch('/api/shifts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          project_id: projectId,
          shift_type: shiftType,
          title: title || undefined,
          notes: notes || undefined,
          attendees,
          entries,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '一括申請に失敗しました')
      }

      const result = await res.json()
      toast.success(`${result.created}件のシフトを${isAutoApproval ? '登録' : '申請'}しました`)
      onOpenChange(false)
      onCreated()
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '一括申請に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setNotes('')
    setShiftType('WORK')
    setSelectedDates(new Set())
    setTimeOverrides({})
    setQuickDays([false, false, false, false, false, false, false])
    setAttendees([])
    setSlotEntries([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            {slotEntries.length > 0
              ? `予定を抑える（${slotEntries.length}枠）`
              : prefill
                ? 'シフト複製'
                : `シフト一括${isAutoApproval ? '登録' : '申請'}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 予約スロット一覧（空き枠から予定を抑える時のみ表示） */}
          {slotEntries.length > 0 && (
            <div className="space-y-2 rounded border border-primary/30 bg-primary/5 p-3">
              <Label className="text-xs">確保する枠（{slotEntries.length}件）</Label>
              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-auto">
                {slotEntries.map((s, i) => (
                  <span
                    key={`${s.date}-${s.startTime}-${i}`}
                    className="inline-flex items-center gap-1 rounded border border-primary/50 bg-background px-2 py-0.5 text-xs"
                  >
                    {formatDateJP(s.date)} {s.startTime}-{s.endTime}
                    <button
                      type="button"
                      onClick={() =>
                        setSlotEntries((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="削除"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Google MeetのURLは作成時に自動発行されます
              </p>
            </div>
          )}

          {/* スタッフ選択 */}
          {(isManager || isOwner) ? (
            <div className="space-y-1.5">
              <Label>スタッフ</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger>
                  <SelectValueWithLabel
                    value={staffId}
                    labels={Object.fromEntries(availableStaff.map(s => [s.id, s.name]))}
                    placeholder="スタッフを選択"
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableStaff.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isOwner && isManager && (
                <p className="text-[10px] text-muted-foreground">自分のPJにアサインされたスタッフのみ選択可能</p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>スタッフ</Label>
              <p className="text-sm font-medium">{availableStaff.find(s => s.id === staffId)?.name || myStaffName || '-'}</p>
            </div>
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
                  ? '自動承認: 登録後すぐにシフトが確定します（Googleカレンダーに自動連携）'
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

          {/* デフォルト時間 */}
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

          {/* 日付選択：ミニカレンダー */}
          <div className="space-y-2">
            <Label>日付を選択</Label>
            <div className="border rounded-lg p-3">
              {/* カレンダーヘッダー */}
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={prevMonth} className="h-7 w-7 rounded hover:bg-muted flex items-center justify-center">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold">{calYear}年{calMonth + 1}月</span>
                <button type="button" onClick={nextMonth} className="h-7 w-7 rounded hover:bg-muted flex items-center justify-center">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* 曜日ヘッダー (月曜始まり) */}
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {WEEK_LABELS_MON_FIRST.map((label, i) => (
                  <div key={i} className={`text-center text-[10px] font-medium ${i === 6 ? 'text-red-500' : i === 5 ? 'text-blue-500' : 'text-muted-foreground'}`}>
                    {label}
                  </div>
                ))}
              </div>

              {/* 日付グリッド */}
              <div className="grid grid-cols-7 gap-0.5">
                {calDays.map((d, i) => {
                  if (!d.inMonth) return <div key={i} />
                  const isSelected = selectedDates.has(d.date)
                  const dayOfWeek = new Date(Number(d.date.split('-')[0]), Number(d.date.split('-')[1]) - 1, d.day).getDay()
                  const holiday = isJpHoliday(d.date)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDate(d.date)}
                      className={`h-8 rounded text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : (dayOfWeek === 0 || holiday) ? 'text-red-500 hover:bg-red-50'
                          : dayOfWeek === 6 ? 'text-blue-500 hover:bg-blue-50'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      {d.day}
                    </button>
                  )
                })}
              </div>

              {/* 曜日パターン一括追加 */}
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground shrink-0">曜日で一括追加:</span>
                  <div className="flex gap-0.5">
                    {WEEK_LABELS_MON_FIRST.map((label, i) => {
                      const jsDay = WEEK_ORDER_MON_FIRST[i]
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setQuickDays(prev => { const n = [...prev]; n[jsDay] = !n[jsDay]; return n })}
                          className={`h-6 w-6 rounded text-[10px] font-medium transition-colors ${
                            quickDays[jsDay]
                              ? jsDay === 0 ? 'bg-red-500 text-white'
                                : jsDay === 6 ? 'bg-blue-500 text-white'
                                : 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={applyDayPattern}>
                    追加
                  </Button>
                  {selectedDates.size > 0 && (
                    <button type="button" onClick={clearDates} className="text-[10px] text-destructive hover:underline ml-auto">
                      全解除
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* シフト種別 + メモ */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>種別</Label>
              <Select value={shiftType} onValueChange={(v) => setShiftType(v as ShiftType)}>
                <SelectTrigger>
                  <SelectValueWithLabel value={shiftType} labels={SHIFT_TYPE_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{SHIFT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>メモ（任意）</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="備考"
              />
            </div>
          </div>

          {/* 招待者 */}
          <AttendeePicker value={attendees} onChange={setAttendees} />

          {/* 選択済み日程プレビュー */}
          {sortedDates.length > 0 && (
            <div className="space-y-1.5">
              <Label>選択済み日程（{sortedDates.length}件）</Label>
              <div className="border rounded-md max-h-[180px] overflow-y-auto divide-y">
                {sortedDates.map(date => {
                  const override = timeOverrides[date]
                  return (
                    <div key={date} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50">
                      <span className="font-medium min-w-[70px]">{formatDateJP(date)}</span>
                      <Input
                        type="time"
                        value={override?.start || startTime}
                        onChange={(e) => setTimeOverrides(prev => ({
                          ...prev,
                          [date]: { start: e.target.value, end: prev[date]?.end || endTime },
                        }))}
                        className="h-7 w-[100px] text-xs"
                      />
                      <span className="text-muted-foreground text-xs">-</span>
                      <Input
                        type="time"
                        value={override?.end || endTime}
                        onChange={(e) => setTimeOverrides(prev => ({
                          ...prev,
                          [date]: { start: prev[date]?.start || startTime, end: e.target.value },
                        }))}
                        className="h-7 w-[100px] text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => removeDate(date)}
                        className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 送信ボタン */}
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm text-muted-foreground">
              {sortedDates.length > 0 ? `${sortedDates.length}件のシフトを作成` : '日付をクリックして選択'}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || sortedDates.length === 0}
              >
                {submitting ? '処理中...' : `一括${isAutoApproval ? '登録' : '申請'}（${sortedDates.length}件）`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
