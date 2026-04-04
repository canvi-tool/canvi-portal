'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { PageHeader } from '@/components/layout/page-header'
import { ShiftWeeklyTimeline } from './_components/shift-weekly-timeline'
import { ShiftEditDialog } from './_components/shift-edit-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// --- Types ---

type ShiftStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION'

interface Shift {
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
  submittedAt?: string
  approvedAt?: string
  approvalMode: 'AUTO' | 'APPROVAL'
  googleCalendarSynced?: boolean
}

interface ProjectOption {
  id: string
  name: string
}

interface StaffOption {
  id: string
  name: string
}

// --- Status helpers ---

const STATUS_CONFIG: Record<ShiftStatus, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: '下書き', color: 'text-gray-700', bgColor: 'bg-gray-100 border-gray-300' },
  SUBMITTED: { label: '申請中', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-300' },
  APPROVED: { label: '承認済', color: 'text-green-700', bgColor: 'bg-green-50 border-green-300' },
  REJECTED: { label: '却下', color: 'text-red-700', bgColor: 'bg-red-50 border-red-300' },
  NEEDS_REVISION: { label: '修正依頼', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-300' },
}

// --- Calendar helpers ---

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay()
}

function formatDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getWeekDates(baseDate: Date): string[] {
  const dates: string[] = []
  const dayOfWeek = baseDate.getDay()
  const startOfWeek = new Date(baseDate)
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek)
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(d.getDate() + i)
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return dates
}

// --- Component ---

export default function ShiftsPage() {
  const router = useRouter()
  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  }, [today])

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [viewMode, setViewMode] = useState<string>('weekly')
  const [filterStaff, setFilterStaff] = useState<string>('all')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<Date>(today)

  // Data from API
  const [shifts, setShifts] = useState<Shift[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [staffList, setStaffList] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)

  // Edit dialog state
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // 日付範囲を計算（表示モードに応じて広めに取得）
  const dateRange = useMemo(() => {
    // 月の前後1週間を含む範囲
    const startDate = new Date(year, month - 2, 1)
    const endDate = new Date(year, month + 1, 0)
    return {
      start: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`,
      end: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`,
    }
  }, [year, month])

  // シフトデータ取得
  const fetchShifts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
      })
      if (filterProject !== 'all') params.set('project_id', filterProject)
      if (filterStaff !== 'all') params.set('staff_id', filterStaff)
      if (filterStatus !== 'all') params.set('status', filterStatus)

      const res = await fetch(`/api/shifts?${params}`)
      if (!res.ok) throw new Error('シフトの取得に失敗しました')

      const data = await res.json()
      const list = data.data || (Array.isArray(data) ? data : [])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: Shift[] = list.map((s: any) => {
        const staff = s.staff || {}
        const project = s.project || {}
        return {
          id: s.id,
          staffId: s.staff_id,
          staffName: `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明',
          projectId: s.project_id || '',
          projectName: project.name || '未割当',
          date: s.shift_date,
          startTime: (s.start_time || '').slice(0, 5),
          endTime: (s.end_time || '').slice(0, 5),
          status: s.status as ShiftStatus,
          notes: s.notes,
          submittedAt: s.submitted_at,
          approvedAt: s.approved_at,
          approvalMode: project.shift_approval_mode || 'AUTO',
          googleCalendarSynced: s.google_calendar_synced || false,
        }
      })

      setShifts(mapped)
    } catch {
      toast.error('シフトの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [dateRange, filterProject, filterStaff, filterStatus])

  // プロジェクトとスタッフ一覧を取得
  useEffect(() => {
    fetch('/api/projects?limit=100')
      .then(r => r.json())
      .then(res => {
        const list = res.data || (Array.isArray(res) ? res : [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProjects(list.map((p: any) => ({ id: p.id, name: p.name })))
      })
      .catch(() => {})

    fetch('/api/staff?status=active&limit=100')
      .then(r => r.json())
      .then(res => {
        const list = res.data || (Array.isArray(res) ? res : [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setStaffList(list.map((s: any) => ({
          id: s.id,
          name: `${s.last_name || ''} ${s.first_name || ''}`.trim(),
        })))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchShifts()
  }, [fetchShifts])

  const handleShiftClick = (shift: { id: string; staffId: string; staffName: string; projectId: string; projectName: string; date: string; startTime: string; endTime: string; status: ShiftStatus; notes?: string }) => {
    const fullShift = shifts.find(s => s.id === shift.id)
    if (fullShift) {
      setEditingShift(fullShift)
      setEditDialogOpen(true)
    }
  }

  const handleShiftSave = async (updated: { id: string; staffName: string; startTime: string; endTime: string }) => {
    try {
      const res = await fetch(`/api/shifts/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: updated.startTime,
          end_time: updated.endTime,
        }),
      })
      if (res.ok) {
        toast.success(`${updated.staffName}のシフトを更新しました`)
        fetchShifts()
      } else {
        toast.error('シフトの更新に失敗しました')
      }
    } catch {
      toast.error('シフトの更新に失敗しました')
    }
  }

  const handleShiftDelete = async (shiftId: string) => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('シフトを削除しました')
        fetchShifts()
      } else {
        toast.error('シフトの削除に失敗しました')
      }
    } catch {
      toast.error('シフトの削除に失敗しました')
    }
  }

  const handleShiftApprove = async (shiftId: string) => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      })
      if (res.ok) {
        toast.success('シフトを承認しました')
        fetchShifts()
      } else {
        toast.error('シフトの承認に失敗しました')
      }
    } catch {
      toast.error('シフトの承認に失敗しました')
    }
  }

  const handleShiftReject = async (shiftId: string) => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT' }),
      })
      if (res.ok) {
        toast.success('シフトを却下しました')
        fetchShifts()
      } else {
        toast.error('シフトの却下に失敗しました')
      }
    } catch {
      toast.error('シフトの却下に失敗しました')
    }
  }

  const handlePrevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12) } else { setMonth(month - 1) }
  }
  const handleNextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1) } else { setMonth(month + 1) }
  }
  const handlePrevWeek = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 7)
    setSelectedDate(d)
  }
  const handleNextWeek = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 7)
    setSelectedDate(d)
  }
  const handlePrevDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    setSelectedDate(d)
  }
  const handleNextDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    setSelectedDate(d)
  }

  // Stats
  const totalShifts = shifts.length
  const pendingCount = shifts.filter(s => s.status === 'SUBMITTED').length
  const approvedCount = shifts.filter(s => s.status === 'APPROVED').length

  // Month shifts grouped by date
  const monthShiftsByDate = useMemo(() => {
    const map: Record<string, Shift[]> = {}
    for (const shift of shifts) {
      const [sy, sm] = shift.date.split('-').map(Number)
      if (sy === year && sm === month) {
        if (!map[shift.date]) map[shift.date] = []
        map[shift.date].push(shift)
      }
    }
    return map
  }, [shifts, year, month])

  // Week dates
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate])

  // Day shifts
  const selectedDayStr = useMemo(() => {
    return `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
  }, [selectedDate])
  const dayShifts = useMemo(() => {
    return shifts.filter(s => s.date === selectedDayStr).sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [shifts, selectedDayStr])

  // Calendar grid
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)

  // Filter labels
  const projectLabels: Record<string, string> = { all: '全プロジェクト', ...Object.fromEntries(projects.map(p => [p.id, p.name])) }
  const staffLabels: Record<string, string> = { all: '全スタッフ', ...Object.fromEntries(staffList.map(s => [s.id, s.name])) }
  const statusLabels: Record<string, string> = { all: '全ステータス', ...Object.fromEntries(Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])) }

  return (
    <div className="space-y-6">
      <PageHeader
        title="シフト管理"
        description="シフトデータを管理します"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/shifts/pending')}
            >
              <Clock className="h-4 w-4 mr-1" />
              承認待ち
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 min-w-4 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => router.push('/shifts/new')}
            >
              <Plus className="h-4 w-4 mr-1" />
              シフト登録
            </Button>
          </div>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <CalendarDays className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{totalShifts}件</p>
              <p className="text-xs text-muted-foreground">総シフト数</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{pendingCount}件</p>
              <p className="text-xs text-muted-foreground">承認待ち</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{approvedCount}件</p>
              <p className="text-xs text-muted-foreground">承認済み</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="h-9 w-auto min-w-[120px] text-sm">
            <SelectValueWithLabel value={filterProject} labels={projectLabels} placeholder="全PJ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全プロジェクト</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-auto min-w-[100px] text-sm">
            <SelectValueWithLabel value={filterStatus} labels={statusLabels} placeholder="全状態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ステータス</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStaff} onValueChange={setFilterStaff}>
          <SelectTrigger className="h-9 w-auto min-w-[100px] text-sm">
            <SelectValueWithLabel value={filterStaff} labels={staffLabels} placeholder="全員" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全スタッフ</SelectItem>
            {staffList.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {loading && (
          <span className="text-xs text-muted-foreground">読み込み中...</span>
        )}
      </div>

      {/* Calendar with Navigation */}
      <Tabs value={viewMode} onValueChange={setViewMode}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={viewMode === 'monthly' ? handlePrevMonth : viewMode === 'weekly' ? handlePrevWeek : handlePrevDay}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[120px] text-center">
              {viewMode === 'monthly' && `${year}年${month}月`}
              {viewMode === 'weekly' && `${weekDates[0]?.slice(5).replace('-', '/')} ~ ${weekDates[6]?.slice(5).replace('-', '/')}`}
              {viewMode === 'daily' && `${selectedDate.getMonth() + 1}/${selectedDate.getDate()}(${WEEKDAY_LABELS[selectedDate.getDay()]})`}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={viewMode === 'monthly' ? handleNextMonth : viewMode === 'weekly' ? handleNextWeek : handleNextDay}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 px-3 ml-1"
              onClick={() => {
                setSelectedDate(today)
                setYear(today.getFullYear())
                setMonth(today.getMonth() + 1)
              }}
            >
              今日
            </Button>
          </div>

          <TabsList className="h-8">
            <TabsTrigger value="monthly" className="text-xs px-3 h-6">月</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs px-3 h-6">週</TabsTrigger>
            <TabsTrigger value="daily" className="text-xs px-3 h-6">日</TabsTrigger>
          </TabsList>
        </div>

        {/* Monthly View */}
        <TabsContent value="monthly">
          <Card>
            <CardContent className="pt-0">
              <div className="grid grid-cols-7 border-b">
                {WEEKDAY_LABELS.map((label, i) => (
                  <div
                    key={label}
                    className={cn(
                      'py-2 text-center text-xs font-medium',
                      i === 0 && 'text-red-500',
                      i === 6 && 'text-blue-500',
                      i !== 0 && i !== 6 && 'text-muted-foreground'
                    )}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[110px] border-b border-r p-1" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateStr = formatDateStr(year, month, day)
                  const dayOfWeek = (firstDay + i) % 7
                  const dayShifts = monthShiftsByDate[dateStr] || []
                  const isToday = dateStr === todayStr

                  return (
                    <div
                      key={day}
                      className={cn(
                        'min-h-[110px] border-b border-r p-1 cursor-pointer transition-colors hover:bg-muted/50',
                        isToday && 'bg-blue-50/50'
                      )}
                      onClick={() => {
                        setSelectedDate(new Date(dateStr + 'T00:00:00'))
                        setViewMode('daily')
                      }}
                    >
                      <div className={cn(
                        'text-xs font-medium mb-1',
                        dayOfWeek === 0 && 'text-red-500',
                        dayOfWeek === 6 && 'text-blue-500'
                      )}>
                        {isToday ? (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-600 text-white text-[10px]">
                            {day}
                          </span>
                        ) : day}
                      </div>
                      <div className="space-y-0.5">
                        {dayShifts.slice(0, 3).map(shift => (
                          <div
                            key={shift.id}
                            className={cn(
                              'text-[10px] leading-tight px-1 py-0.5 rounded border truncate',
                              STATUS_CONFIG[shift.status]?.bgColor,
                              STATUS_CONFIG[shift.status]?.color
                            )}
                          >
                            {shift.startTime.slice(0, 5)} {shift.staffName}
                          </div>
                        ))}
                        {dayShifts.length > 3 && (
                          <div className="text-[10px] text-muted-foreground px-1">
                            +{dayShifts.length - 3}件
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={cn('inline-block w-3 h-3 rounded border', val.bgColor)} />
                <span className="text-xs text-muted-foreground">{val.label}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Weekly View */}
        <TabsContent value="weekly">
          <ShiftWeeklyTimeline
            weekDates={weekDates}
            shifts={shifts}
            onShiftClick={handleShiftClick}
          />
        </TabsContent>

        {/* Daily View */}
        <TabsContent value="daily">
          <ShiftWeeklyTimeline
            weekDates={[selectedDayStr]}
            shifts={dayShifts}
            onShiftClick={handleShiftClick}
          />
        </TabsContent>
      </Tabs>

      {/* Shift Edit Dialog */}
      <ShiftEditDialog
        shift={editingShift}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleShiftSave}
        onDelete={handleShiftDelete}
        onApprove={handleShiftApprove}
        onReject={handleShiftReject}
      />
    </div>
  )
}
