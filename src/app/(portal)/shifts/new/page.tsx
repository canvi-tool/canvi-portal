'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Send,
  Clock,
  CalendarDays,
  Briefcase,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Loader2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { PageHeader } from '@/components/layout/page-header'
import { toast } from 'sonner'

// --- Types ---

type ApprovalMode = 'AUTO' | 'APPROVAL'

interface Project {
  id: string
  name: string
  project_code: string
  shift_approval_mode: ApprovalMode
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABELS[d.getDay()]})`
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// --- Calendar Component ---

function MultiDateCalendar({
  selectedDates,
  onToggleDate,
}: {
  selectedDates: Set<string>
  onToggleDate: (date: string) => void
}) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const startDow = firstDay.getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    const days: { dateStr: string; day: number; inMonth: boolean }[] = []

    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      const m = viewMonth === 0 ? 11 : viewMonth - 1
      const y = viewMonth === 0 ? viewYear - 1 : viewYear
      days.push({ dateStr: toDateStr(y, m, d), day: d, inMonth: false })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ dateStr: toDateStr(viewYear, viewMonth, d), day: d, inMonth: true })
    }

    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1
      const y = viewMonth === 11 ? viewYear + 1 : viewYear
      days.push({ dateStr: toDateStr(y, m, d), day: d, inMonth: false })
    }

    return days
  }, [viewYear, viewMonth])

  const goPrev = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11) }
    else setViewMonth(viewMonth - 1)
  }

  const goNext = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0) }
    else setViewMonth(viewMonth + 1)
  }

  const selectWeekdays = () => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toDateStr(viewYear, viewMonth, d)
      const dow = new Date(viewYear, viewMonth, d).getDay()
      if (dow >= 1 && dow <= 5 && !selectedDates.has(dateStr)) {
        onToggleDate(dateStr)
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={goPrev} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">
          {viewYear}年{viewMonth + 1}月
        </span>
        <Button variant="ghost" size="icon" onClick={goNext} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={selectWeekdays}>
          平日を全選択
        </Button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`text-xs font-medium py-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground'}`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map(({ dateStr, day, inMonth }, idx) => {
          const isSelected = selectedDates.has(dateStr)
          const isToday = dateStr === todayStr
          const dow = idx % 7

          return (
            <button
              key={dateStr + idx}
              type="button"
              onClick={() => inMonth && onToggleDate(dateStr)}
              disabled={!inMonth}
              className={`
                h-9 w-full rounded-md text-sm transition-colors relative
                ${!inMonth ? 'text-muted-foreground/30 cursor-default' : 'cursor-pointer hover:bg-muted'}
                ${isSelected ? 'bg-primary text-primary-foreground hover:bg-primary/90 font-semibold' : ''}
                ${isToday && !isSelected ? 'ring-1 ring-primary font-semibold' : ''}
                ${!isSelected && inMonth && dow === 0 ? 'text-red-500' : ''}
                ${!isSelected && inMonth && dow === 6 ? 'text-blue-500' : ''}
              `}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// --- Main Component ---

export default function ShiftNewPage() {
  const router = useRouter()

  const [projects, setProjects] = useState<Project[]>([])
  const [staffId, setStaffId] = useState<string>('')
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('18:00')
  const [projectId, setProjectId] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [resultStatus, setResultStatus] = useState<'APPROVED' | 'DRAFT' | null>(null)
  const [resultCount, setResultCount] = useState(0)

  // ログインユーザーのスタッフIDとアサイン済みプロジェクトを取得
  useEffect(() => {
    // 自分のスタッフ情報を取得
    fetch('/api/staff/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.id) setStaffId(data.id)
      })
      .catch(() => {})

    // プロジェクト一覧を取得（アクティブなもの）
    fetch('/api/projects?status=active&status=in_progress&limit=100')
      .then(r => r.json())
      .then(res => {
        const list = res.data || (Array.isArray(res) ? res : [])
        setProjects(list.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          name: p.name as string,
          project_code: p.project_code as string || '',
          shift_approval_mode: (p.shift_approval_mode as ApprovalMode) || 'AUTO',
        })))
      })
      .catch(() => {})
  }, [])

  const selectedProject = projects.find(p => p.id === projectId)
  const isAutoApproval = selectedProject?.shift_approval_mode === 'AUTO'
  const projectLabels = Object.fromEntries(
    projects.map(p => [p.id, `${p.name}${p.shift_approval_mode === 'AUTO' ? ' (自動承認)' : ' (承認制)'}`])
  )

  const sortedDates = useMemo(
    () => [...selectedDates].sort(),
    [selectedDates]
  )

  const toggleDate = (dateStr: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
    setErrors(prev => ({ ...prev, dates: '' }))
  }

  const removeDate = (dateStr: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev)
      next.delete(dateStr)
      return next
    })
  }

  const clearAllDates = () => {
    setSelectedDates(new Set())
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (selectedDates.size === 0) newErrors.dates = '日付を1つ以上選択してください'
    if (!startTime) newErrors.startTime = '開始時間を入力してください'
    if (!endTime) newErrors.endTime = '終了時間を入力してください'
    if (!projectId) newErrors.projectId = 'プロジェクトを選択してください'
    if (startTime && endTime && startTime >= endTime) {
      newErrors.endTime = '終了時間は開始時間より後にしてください'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)

    let successCount = 0
    const failedDates: string[] = []

    for (const date of sortedDates) {
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
            notes: notes || undefined,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          successCount++
          // 最後に作成されたシフトのステータスを結果に反映
          if (data.status === 'APPROVED') {
            setResultStatus('APPROVED')
          } else {
            setResultStatus('DRAFT')
          }
        } else {
          failedDates.push(date)
        }
      } catch {
        failedDates.push(date)
      }
    }

    setSubmitting(false)
    setResultCount(successCount)

    if (failedDates.length > 0) {
      toast.error(`${failedDates.length}件のシフト登録に失敗しました`)
    }

    if (successCount > 0) {
      if (!resultStatus) {
        setResultStatus(isAutoApproval ? 'APPROVED' : 'DRAFT')
      }
      setSubmitted(true)
    }
  }

  const handleSaveDraft = () => {
    handleSubmit()
  }

  if (submitted && resultStatus) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="シフト登録"
          description="シフトの新規登録"
          actions={
            <Button variant="outline" size="sm" onClick={() => router.push('/shifts')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              シフト一覧に戻る
            </Button>
          }
        />
        <Card>
          <CardContent className="py-12 text-center">
            {resultStatus === 'APPROVED' ? (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {resultCount}件のシフトが登録されました
                </h3>
                <p className="text-sm text-muted-foreground mb-1">
                  プロジェクト「{selectedProject?.name}」は自動承認モードのため、即座に承認されました。
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                  {sortedDates.map(d => (
                    <Badge key={d} variant="default" className="bg-green-100 text-green-800 border-green-200">
                      {formatDate(d)}
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <FileText className="h-8 w-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {resultCount}件のシフトが下書き保存されました
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  プロジェクト「{selectedProject?.name}」は承認制のため、PMの承認が必要です。
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                  {sortedDates.map(d => (
                    <Badge key={d} variant="outline" className="text-gray-700 border-gray-300">
                      {formatDate(d)}
                    </Badge>
                  ))}
                </div>
              </>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => router.push('/shifts')}>
                シフト一覧へ
              </Button>
              <Button onClick={() => {
                setSubmitted(false)
                setResultStatus(null)
                setSelectedDates(new Set())
                setProjectId('')
                setNotes('')
                setResultCount(0)
              }}>
                続けて登録
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="シフト一括登録"
        description="プロジェクトと時間を指定して、複数日のシフトをまとめて登録します"
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/shifts')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            シフト一覧に戻る
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                <Briefcase className="inline h-4 w-4 mr-1.5" />
                プロジェクト・時間設定
              </CardTitle>
              <CardDescription>
                全日程に共通の設定を入力してください
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>
                  プロジェクト <span className="text-destructive">*</span>
                </Label>
                <Select value={projectId} onValueChange={v => { setProjectId(v); setErrors(prev => ({ ...prev, projectId: '' })) }}>
                  <SelectTrigger className="w-full">
                    <SelectValueWithLabel value={projectId || null} labels={projectLabels} placeholder="プロジェクトを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.shift_approval_mode === 'AUTO' ? ' (自動承認)' : ' (承認制)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.projectId && <p className="text-xs text-destructive">{errors.projectId}</p>}
                {selectedProject && (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant={isAutoApproval ? 'default' : 'outline'}
                      className={isAutoApproval
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : 'text-amber-700 border-amber-300'
                      }
                    >
                      {isAutoApproval ? '自動承認' : '承認制'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {isAutoApproval ? '登録後すぐに承認されます' : 'PMの承認が必要です'}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">
                    <Clock className="inline h-4 w-4 mr-1" />
                    開始時間 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={e => { setStartTime(e.target.value); setErrors(prev => ({ ...prev, startTime: '', endTime: '' })) }}
                  />
                  {errors.startTime && <p className="text-xs text-destructive">{errors.startTime}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">
                    <Clock className="inline h-4 w-4 mr-1" />
                    終了時間 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={e => { setEndTime(e.target.value); setErrors(prev => ({ ...prev, endTime: '' })) }}
                  />
                  {errors.endTime && <p className="text-xs text-destructive">{errors.endTime}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">
                  <FileText className="inline h-4 w-4 mr-1" />
                  備考（任意）
                </Label>
                <Textarea
                  id="notes"
                  placeholder="備考があれば入力してください"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Selected dates summary & actions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  <CalendarDays className="inline h-4 w-4 mr-1.5" />
                  選択中の日程
                  {selectedDates.size > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedDates.size}日
                    </Badge>
                  )}
                </CardTitle>
                {selectedDates.size > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={clearAllDates}>
                    すべてクリア
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedDates.size === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  右のカレンダーから日付を選択してください
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {sortedDates.map(d => (
                    <Badge
                      key={d}
                      variant="secondary"
                      className="pl-2 pr-1 py-1 gap-1 cursor-pointer hover:bg-destructive/10"
                      onClick={() => removeDate(d)}
                    >
                      {formatDate(d)}
                      <X className="h-3 w-3 text-muted-foreground" />
                    </Badge>
                  ))}
                </div>
              )}
              {errors.dates && <p className="text-xs text-destructive mt-2">{errors.dates}</p>}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 mt-4 border-t">
                {selectedProject?.shift_approval_mode === 'APPROVAL' && (
                  <Button variant="outline" onClick={handleSaveDraft} disabled={submitting}>
                    <Save className="h-4 w-4 mr-1" />
                    下書き保存
                  </Button>
                )}
                <Button onClick={handleSubmit} disabled={selectedDates.size === 0 || submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : isAutoApproval ? (
                    <CalendarDays className="h-4 w-4 mr-1" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  {selectedDates.size > 0 ? `${selectedDates.size}件を${isAutoApproval ? '登録' : '申請'}する` : '登録する'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Calendar */}
        <div>
          <Card className="sticky top-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">日付を選択</CardTitle>
              <CardDescription>
                クリックで日付を選択・解除できます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MultiDateCalendar
                selectedDates={selectedDates}
                onToggleDate={toggleDate}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
