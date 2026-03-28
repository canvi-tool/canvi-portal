'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Filter,
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
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/layout/page-header'
import { cn } from '@/lib/utils'

// --- Types ---

type ShiftStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION'
type ApprovalMode = 'AUTO' | 'APPROVAL'

interface DemoShift {
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
  approvalMode: ApprovalMode
  googleCalendarSynced?: boolean
}

interface DemoProject {
  id: string
  name: string
  approvalMode: ApprovalMode
}

// --- Demo Data ---

const DEMO_PROJECTS: DemoProject[] = [
  { id: 'pj1', name: 'AIアポブースト', approvalMode: 'AUTO' },
  { id: 'pj2', name: 'WHITE営業代行', approvalMode: 'APPROVAL' },
  { id: 'pj3', name: 'ミズテック受電', approvalMode: 'APPROVAL' },
  { id: 'pj4', name: 'リクモ架電PJ', approvalMode: 'AUTO' },
]

const DEMO_STAFF = [
  { id: 's1', name: '佐藤健太' },
  { id: 's2', name: '田中美咲' },
  { id: 's3', name: '鈴木一郎' },
  { id: 's4', name: '山田花子' },
  { id: 's5', name: '高橋雄太' },
]

const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

function dayOffset(offset: number): string {
  const d = new Date(today)
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DEMO_SHIFTS: DemoShift[] = [
  // Today
  { id: '1', staffId: 's1', staffName: '佐藤健太', projectId: 'pj1', projectName: 'AIアポブースト', date: todayStr, startTime: '09:00', endTime: '18:00', status: 'APPROVED', approvalMode: 'AUTO', googleCalendarSynced: true },
  { id: '2', staffId: 's2', staffName: '田中美咲', projectId: 'pj2', projectName: 'WHITE営業代行', date: todayStr, startTime: '10:00', endTime: '19:00', status: 'SUBMITTED', submittedAt: '2026-03-27T20:00:00', approvalMode: 'APPROVAL' },
  { id: '3', staffId: 's3', staffName: '鈴木一郎', projectId: 'pj3', projectName: 'ミズテック受電', date: todayStr, startTime: '09:00', endTime: '17:00', status: 'APPROVED', approvedAt: '2026-03-27T18:00:00', approvalMode: 'APPROVAL', googleCalendarSynced: true },
  { id: '4', staffId: 's4', staffName: '山田花子', projectId: 'pj1', projectName: 'AIアポブースト', date: todayStr, startTime: '13:00', endTime: '22:00', status: 'APPROVED', approvalMode: 'AUTO', googleCalendarSynced: true },
  { id: '5', staffId: 's5', staffName: '高橋雄太', projectId: 'pj4', projectName: 'リクモ架電PJ', date: todayStr, startTime: '09:00', endTime: '18:00', status: 'DRAFT', approvalMode: 'AUTO' },
  // Yesterday
  { id: '6', staffId: 's1', staffName: '佐藤健太', projectId: 'pj2', projectName: 'WHITE営業代行', date: dayOffset(-1), startTime: '09:00', endTime: '18:00', status: 'APPROVED', approvedAt: '2026-03-26T10:00:00', approvalMode: 'APPROVAL', googleCalendarSynced: true },
  { id: '7', staffId: 's2', staffName: '田中美咲', projectId: 'pj3', projectName: 'ミズテック受電', date: dayOffset(-1), startTime: '10:00', endTime: '19:00', status: 'REJECTED', approvalMode: 'APPROVAL' },
  { id: '8', staffId: 's3', staffName: '鈴木一郎', projectId: 'pj1', projectName: 'AIアポブースト', date: dayOffset(-1), startTime: '09:00', endTime: '18:00', status: 'APPROVED', approvalMode: 'AUTO', googleCalendarSynced: true },
  { id: '9', staffId: 's5', staffName: '高橋雄太', projectId: 'pj2', projectName: 'WHITE営業代行', date: dayOffset(-1), startTime: '13:00', endTime: '22:00', status: 'NEEDS_REVISION', approvalMode: 'APPROVAL' },
  // 2 days ago
  { id: '10', staffId: 's1', staffName: '佐藤健太', projectId: 'pj1', projectName: 'AIアポブースト', date: dayOffset(-2), startTime: '09:00', endTime: '18:00', status: 'APPROVED', approvalMode: 'AUTO', googleCalendarSynced: true },
  { id: '11', staffId: 's4', staffName: '山田花子', projectId: 'pj3', projectName: 'ミズテック受電', date: dayOffset(-2), startTime: '10:00', endTime: '19:00', status: 'APPROVED', approvedAt: '2026-03-25T09:00:00', approvalMode: 'APPROVAL', googleCalendarSynced: true },
  { id: '12', staffId: 's2', staffName: '田中美咲', projectId: 'pj2', projectName: 'WHITE営業代行', date: dayOffset(-2), startTime: '09:00', endTime: '18:00', status: 'SUBMITTED', submittedAt: '2026-03-25T21:00:00', approvalMode: 'APPROVAL' },
  // 3 days ago
  { id: '13', staffId: 's3', staffName: '鈴木一郎', projectId: 'pj4', projectName: 'リクモ架電PJ', date: dayOffset(-3), startTime: '09:00', endTime: '18:00', status: 'APPROVED', approvalMode: 'AUTO', googleCalendarSynced: true },
  { id: '14', staffId: 's5', staffName: '高橋雄太', projectId: 'pj1', projectName: 'AIアポブースト', date: dayOffset(-3), startTime: '10:00', endTime: '16:00', status: 'APPROVED', approvalMode: 'AUTO', googleCalendarSynced: true },
  // Tomorrow
  { id: '15', staffId: 's1', staffName: '佐藤健太', projectId: 'pj3', projectName: 'ミズテック受電', date: dayOffset(1), startTime: '09:00', endTime: '18:00', status: 'SUBMITTED', submittedAt: '2026-03-28T08:00:00', approvalMode: 'APPROVAL' },
  { id: '16', staffId: 's2', staffName: '田中美咲', projectId: 'pj1', projectName: 'AIアポブースト', date: dayOffset(1), startTime: '09:00', endTime: '18:00', status: 'APPROVED', approvalMode: 'AUTO', googleCalendarSynced: true },
  // Day after tomorrow
  { id: '17', staffId: 's4', staffName: '山田花子', projectId: 'pj2', projectName: 'WHITE営業代行', date: dayOffset(2), startTime: '10:00', endTime: '19:00', status: 'DRAFT', approvalMode: 'APPROVAL' },
  { id: '18', staffId: 's3', staffName: '鈴木一郎', projectId: 'pj2', projectName: 'WHITE営業代行', date: dayOffset(2), startTime: '09:00', endTime: '17:00', status: 'SUBMITTED', submittedAt: '2026-03-28T10:00:00', approvalMode: 'APPROVAL' },
]

// --- Status helpers ---

const STATUS_CONFIG: Record<ShiftStatus, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: '下書き', color: 'text-gray-700', bgColor: 'bg-gray-100 border-gray-300' },
  SUBMITTED: { label: '申請中', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-300' },
  APPROVED: { label: '承認済', color: 'text-green-700', bgColor: 'bg-green-50 border-green-300' },
  REJECTED: { label: '却下', color: 'text-red-700', bgColor: 'bg-red-50 border-red-300' },
  NEEDS_REVISION: { label: '修正依頼', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-300' },
}

function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border', config.bgColor, config.color)}>
      {config.label}
    </span>
  )
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

const HOUR_SLOTS = Array.from({ length: 16 }, (_, i) => i + 7) // 7:00 - 22:00

// --- Component ---

export default function ShiftsPage() {
  const router = useRouter()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [viewMode, setViewMode] = useState<string>('monthly')
  const [filterStaff, setFilterStaff] = useState<string>('all')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [, setSelectedDayDetail] = useState<string | null>(null)

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

  // Filtered shifts
  const filteredShifts = useMemo(() => {
    return DEMO_SHIFTS.filter(shift => {
      if (filterStaff !== 'all' && shift.staffId !== filterStaff) return false
      if (filterProject !== 'all' && shift.projectId !== filterProject) return false
      if (filterStatus !== 'all' && shift.status !== filterStatus) return false
      return true
    })
  }, [filterStaff, filterProject, filterStatus])

  // Stats
  const totalShifts = DEMO_SHIFTS.length
  const pendingCount = DEMO_SHIFTS.filter(s => s.status === 'SUBMITTED').length
  const approvedCount = DEMO_SHIFTS.filter(s => s.status === 'APPROVED').length

  // Month shifts grouped by date
  const monthShiftsByDate = useMemo(() => {
    const map: Record<string, DemoShift[]> = {}
    for (const shift of filteredShifts) {
      const [sy, sm] = shift.date.split('-').map(Number)
      if (sy === year && sm === month) {
        if (!map[shift.date]) map[shift.date] = []
        map[shift.date].push(shift)
      }
    }
    return map
  }, [filteredShifts, year, month])

  // Week dates and shifts
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate])
  const weekShiftsByDate = useMemo(() => {
    const map: Record<string, DemoShift[]> = {}
    for (const dateStr of weekDates) {
      map[dateStr] = filteredShifts.filter(s => s.date === dateStr)
    }
    return map
  }, [filteredShifts, weekDates])

  // Day shifts
  const selectedDayStr = useMemo(() => {
    return `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
  }, [selectedDate])
  const dayShifts = useMemo(() => {
    return filteredShifts.filter(s => s.date === selectedDayStr).sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [filteredShifts, selectedDayStr])

  // Calendar grid
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)

  return (
    <div className="space-y-6">
      <PageHeader
        title="シフト管理"
        description="プラットフォームのシフトデータを管理します。承認済みシフトのみGoogleカレンダーに同期されます。"
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
              variant="outline"
              size="sm"
              onClick={() => router.push('/shifts/sync')}
            >
              <CalendarDays className="h-4 w-4 mr-1" />
              同期状況
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

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>フィルター:</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="全プロジェクト" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全プロジェクト</SelectItem>
              {DEMO_PROJECTS.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="全ステータス" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全ステータス</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStaff} onValueChange={setFilterStaff}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="全スタッフ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全スタッフ</SelectItem>
              {DEMO_STAFF.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={setViewMode}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="monthly">月表示</TabsTrigger>
            <TabsTrigger value="weekly">週表示</TabsTrigger>
            <TabsTrigger value="daily">日表示</TabsTrigger>
          </TabsList>

          {/* Navigation arrows per view */}
          <div className="flex items-center gap-2">
            {viewMode === 'monthly' && (
              <>
                <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold min-w-[120px] text-center">
                  {year}年{month}月
                </span>
                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {viewMode === 'weekly' && (
              <>
                <Button variant="outline" size="icon" onClick={handlePrevWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold min-w-[200px] text-center">
                  {weekDates[0]?.replace(/-/g, '/')} ~ {weekDates[6]?.replace(/-/g, '/')}
                </span>
                <Button variant="outline" size="icon" onClick={handleNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {viewMode === 'daily' && (
              <>
                <Button variant="outline" size="icon" onClick={handlePrevDay}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold min-w-[160px] text-center">
                  {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日({WEEKDAY_LABELS[selectedDate.getDay()]})
                </span>
                <Button variant="outline" size="icon" onClick={handleNextDay}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
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
                  const shifts = monthShiftsByDate[dateStr] || []
                  const isToday = dateStr === todayStr

                  return (
                    <div
                      key={day}
                      className={cn(
                        'min-h-[110px] border-b border-r p-1 cursor-pointer transition-colors hover:bg-muted/50',
                        isToday && 'bg-blue-50/50'
                      )}
                      onClick={() => {
                        setSelectedDayDetail(dateStr)
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
                        {shifts.slice(0, 3).map(shift => (
                          <div
                            key={shift.id}
                            className={cn(
                              'text-[10px] leading-tight px-1 py-0.5 rounded border truncate',
                              STATUS_CONFIG[shift.status].bgColor,
                              STATUS_CONFIG[shift.status].color
                            )}
                          >
                            {shift.startTime.slice(0, 5)} {shift.staffName}
                          </div>
                        ))}
                        {shifts.length > 3 && (
                          <div className="text-[10px] text-muted-foreground px-1">
                            +{shifts.length - 3}件
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Status Legend */}
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
          <Card>
            <CardContent className="pt-0 overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Header row */}
                <div className="grid grid-cols-8 border-b">
                  <div className="py-2 px-2 text-xs font-medium text-muted-foreground border-r">時間</div>
                  {weekDates.map((dateStr, i) => {
                    const d = new Date(dateStr + 'T00:00:00')
                    const isToday_ = dateStr === todayStr
                    return (
                      <div
                        key={dateStr}
                        className={cn(
                          'py-2 px-1 text-center text-xs font-medium',
                          i === 0 && 'text-red-500',
                          i === 6 && 'text-blue-500',
                          isToday_ && 'bg-blue-50/50'
                        )}
                      >
                        <div>{WEEKDAY_LABELS[i]}</div>
                        <div className={cn(
                          'text-sm font-semibold',
                          isToday_ && 'text-blue-600'
                        )}>
                          {d.getDate()}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Time slots */}
                {HOUR_SLOTS.map(hour => (
                  <div key={hour} className="grid grid-cols-8 border-b min-h-[48px]">
                    <div className="py-1 px-2 text-[11px] text-muted-foreground border-r flex items-start">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                    {weekDates.map((dateStr) => {
                      const dayShifts_ = weekShiftsByDate[dateStr] || []
                      const hourShifts_ = dayShifts_.filter(s => {
                        const startHour = parseInt(s.startTime.split(':')[0])
                        return startHour === hour
                      })
                      const isToday_ = dateStr === todayStr
                      return (
                        <div
                          key={dateStr}
                          className={cn(
                            'py-0.5 px-0.5 border-r',
                            isToday_ && 'bg-blue-50/30'
                          )}
                        >
                          {hourShifts_.map(shift => {
                            const startH = parseInt(shift.startTime.split(':')[0])
                            const endH = parseInt(shift.endTime.split(':')[0])
                            const span = endH - startH
                            return (
                              <div
                                key={shift.id}
                                className={cn(
                                  'text-[10px] leading-tight px-1 py-0.5 rounded border mb-0.5 cursor-pointer hover:opacity-80',
                                  STATUS_CONFIG[shift.status].bgColor,
                                  STATUS_CONFIG[shift.status].color
                                )}
                                style={{ minHeight: `${Math.max(span * 48 - 4, 20)}px` }}
                                onClick={() => router.push(`/shifts/${shift.id}`)}
                              >
                                <div className="font-medium truncate">{shift.staffName}</div>
                                <div className="truncate">{shift.startTime}-{shift.endTime}</div>
                                <div className="truncate">{shift.projectName}</div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily View */}
        <TabsContent value="daily">
          <Card>
            <CardContent className="pt-0">
              {dayShifts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  この日のシフトはありません
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Timeline */}
                  {HOUR_SLOTS.map(hour => {
                    const hourStr = String(hour).padStart(2, '0')
                    // hourShifts not needed for day view - we use startsThisHour instead
                    const startsThisHour = dayShifts.filter(s => parseInt(s.startTime.split(':')[0]) === hour)

                    return (
                      <div key={hour} className="flex border-b min-h-[50px]">
                        <div className="w-16 shrink-0 py-2 text-xs text-muted-foreground text-right pr-3 border-r">
                          {hourStr}:00
                        </div>
                        <div className="flex-1 py-1 px-2 flex gap-2 flex-wrap">
                          {startsThisHour.map(shift => (
                            <div
                              key={shift.id}
                              className={cn(
                                'text-xs px-2 py-1.5 rounded border cursor-pointer hover:opacity-80 min-w-[140px]',
                                STATUS_CONFIG[shift.status].bgColor,
                                STATUS_CONFIG[shift.status].color
                              )}
                              onClick={() => router.push(`/shifts/${shift.id}`)}
                            >
                              <div className="font-medium">{shift.staffName}</div>
                              <div>{shift.startTime} - {shift.endTime}</div>
                              <div className="text-[11px] opacity-80">{shift.projectName}</div>
                              <ShiftStatusBadge status={shift.status} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
