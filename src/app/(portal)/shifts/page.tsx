'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  List,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Settings,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/layout/page-header'

// --- Demo Data ---

const DEMO_STAFF_CALENDARS = [
  { id: '1', staffName: '田中太郎', email: 'tanaka@example.com', calendarStatus: 'connected' as const, lastSyncAt: '2026-03-28T08:00:00' },
  { id: '2', staffName: '佐藤花子', email: 'sato@example.com', calendarStatus: 'connected' as const, lastSyncAt: '2026-03-28T07:30:00' },
  { id: '3', staffName: '鈴木一郎', email: 'suzuki@example.com', calendarStatus: 'error' as const, lastSyncAt: '2026-03-25T10:00:00' },
  { id: '4', staffName: '高橋美咲', email: 'takahashi@example.com', calendarStatus: 'disconnected' as const, lastSyncAt: null },
  { id: '5', staffName: '渡辺健太', email: 'watanabe@example.com', calendarStatus: 'connected' as const, lastSyncAt: '2026-03-28T08:15:00' },
]

const DEMO_SHIFTS = [
  { id: '1', staffId: '1', staffName: '田中太郎', projectId: 'pj1', projectName: 'PJ-Alpha', date: '2026-03-28', startTime: '09:00', endTime: '18:00', source: 'google_calendar' as const },
  { id: '2', staffId: '1', staffName: '田中太郎', projectId: 'pj2', projectName: 'PJ-Beta', date: '2026-03-28', startTime: '19:00', endTime: '21:00', source: 'google_calendar' as const },
  { id: '3', staffId: '2', staffName: '佐藤花子', projectId: 'pj1', projectName: 'PJ-Alpha', date: '2026-03-28', startTime: '10:00', endTime: '19:00', source: 'google_calendar' as const },
  { id: '4', staffId: '5', staffName: '渡辺健太', projectId: 'pj3', projectName: 'PJ-Gamma', date: '2026-03-28', startTime: '09:00', endTime: '17:00', source: 'google_calendar' as const },
  { id: '5', staffId: '1', staffName: '田中太郎', projectId: 'pj1', projectName: 'PJ-Alpha', date: '2026-03-27', startTime: '09:00', endTime: '18:00', source: 'google_calendar' as const },
  { id: '6', staffId: '2', staffName: '佐藤花子', projectId: 'pj2', projectName: 'PJ-Beta', date: '2026-03-27', startTime: '09:00', endTime: '18:00', source: 'google_calendar' as const },
  { id: '7', staffId: '5', staffName: '渡辺健太', projectId: 'pj3', projectName: 'PJ-Gamma', date: '2026-03-27', startTime: '10:00', endTime: '19:00', source: 'google_calendar' as const },
  { id: '8', staffId: '1', staffName: '田中太郎', projectId: 'pj1', projectName: 'PJ-Alpha', date: '2026-03-26', startTime: '09:00', endTime: '18:00', source: 'google_calendar' as const },
  { id: '9', staffId: '2', staffName: '佐藤花子', projectId: 'pj1', projectName: 'PJ-Alpha', date: '2026-03-26', startTime: '10:00', endTime: '19:00', source: 'google_calendar' as const },
  { id: '10', staffId: '5', staffName: '渡辺健太', projectId: 'pj1', projectName: 'PJ-Alpha', date: '2026-03-26', startTime: '09:00', endTime: '17:00', source: 'google_calendar' as const },
  { id: '11', staffId: '1', staffName: '田中太郎', projectId: 'pj2', projectName: 'PJ-Beta', date: '2026-03-25', startTime: '09:00', endTime: '18:00', source: 'google_calendar' as const },
  { id: '12', staffId: '2', staffName: '佐藤花子', projectId: 'pj1', projectName: 'PJ-Alpha', date: '2026-03-25', startTime: '10:00', endTime: '19:00', source: 'google_calendar' as const },
  { id: '13', staffId: '1', staffName: '田中太郎', projectId: 'pj1', projectName: 'PJ-Alpha', date: '2026-03-24', startTime: '09:00', endTime: '18:00', source: 'google_calendar' as const },
  { id: '14', staffId: '2', staffName: '佐藤花子', projectId: 'pj2', projectName: 'PJ-Beta', date: '2026-03-24', startTime: '10:00', endTime: '16:00', source: 'google_calendar' as const },
]

const PROJECT_COLORS: Record<string, string> = {
  'pj1': 'bg-blue-100 text-blue-800 border-blue-200',
  'pj2': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'pj3': 'bg-purple-100 text-purple-800 border-purple-200',
}

const DEMO_PROJECTS = [
  { id: 'pj1', name: 'PJ-Alpha' },
  { id: 'pj2', name: 'PJ-Beta' },
  { id: 'pj3', name: 'PJ-Gamma' },
]

// --- Helpers ---

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay()
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// --- Component ---

export default function ShiftsPage() {
  const router = useRouter()
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(3)
  const [viewMode, setViewMode] = useState<string>('staff')
  const [displayMode, setDisplayMode] = useState<'calendar' | 'list'>('calendar')
  const [filterStaff, setFilterStaff] = useState<string>('all')
  const [filterProject, setFilterProject] = useState<string>('all')

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else {
      setMonth(month - 1)
    }
  }

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else {
      setMonth(month + 1)
    }
  }

  // Connection status counts
  const connectedCount = DEMO_STAFF_CALENDARS.filter(s => s.calendarStatus === 'connected').length
  const disconnectedCount = DEMO_STAFF_CALENDARS.filter(s => s.calendarStatus === 'disconnected').length
  const errorCount = DEMO_STAFF_CALENDARS.filter(s => s.calendarStatus === 'error').length
  const errorStaff = DEMO_STAFF_CALENDARS.filter(s => s.calendarStatus === 'error')

  // Filtered shifts
  const filteredShifts = useMemo(() => {
    return DEMO_SHIFTS.filter(shift => {
      if (filterStaff !== 'all' && shift.staffId !== filterStaff) return false
      if (filterProject !== 'all' && shift.projectId !== filterProject) return false
      return true
    })
  }, [filterStaff, filterProject])

  // Shifts grouped by date for the current month
  const shiftsByDate = useMemo(() => {
    const map: Record<string, typeof DEMO_SHIFTS> = {}
    for (const shift of filteredShifts) {
      const [sy, sm] = shift.date.split('-').map(Number)
      if (sy === year && sm === month) {
        if (!map[shift.date]) map[shift.date] = []
        map[shift.date].push(shift)
      }
    }
    return map
  }, [filteredShifts, year, month])

  // Unique staff list from demo data
  const staffOptions = useMemo(() => {
    const seen = new Map<string, string>()
    DEMO_SHIFTS.forEach(s => seen.set(s.staffId, s.staffName))
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [])

  // Calendar grid data
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)

  // List view: shifts sorted by date descending
  const listShifts = useMemo(() => {
    const monthShifts = filteredShifts.filter(s => {
      const [sy, sm] = s.date.split('-').map(Number)
      return sy === year && sm === month
    })
    return monthShifts.sort((a, b) => b.date.localeCompare(a.date))
  }, [filteredShifts, year, month])

  // Group list shifts by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof DEMO_SHIFTS> = {}
    for (const shift of listShifts) {
      if (!groups[shift.date]) groups[shift.date] = []
      groups[shift.date].push(shift)
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [listShifts])

  return (
    <div className="space-y-6">
      <PageHeader
        title="シフト管理"
        description="スタッフのGoogleカレンダーから取得したシフト予定を表示します"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/shifts/sync')}
            >
              <Settings className="h-4 w-4 mr-1" />
              同期設定
            </Button>
          </div>
        }
      />

      {/* Connection Status Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{connectedCount}名</p>
              <p className="text-xs text-muted-foreground">連携済み</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-bold">{disconnectedCount}名</p>
              <p className="text-xs text-muted-foreground">未連携</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{errorCount}名</p>
              <p className="text-xs text-muted-foreground">同期エラー</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert Banner */}
      {errorStaff.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-yellow-800">カレンダー同期エラー</p>
            <p className="text-yellow-700">
              {errorStaff.map(s => s.staffName).join('、')}のGoogleカレンダー同期でエラーが発生しています。
              <button
                className="ml-1 underline hover:no-underline"
                onClick={() => router.push('/shifts/sync')}
              >
                同期設定を確認
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[140px] text-center">
            {year}年{month}月
          </h2>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters and Toggles */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={filterStaff} onValueChange={setFilterStaff}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="全スタッフ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全スタッフ</SelectItem>
              {staffOptions.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="全プロジェクト" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全プロジェクト</SelectItem>
              {DEMO_PROJECTS.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList>
              <TabsTrigger value="staff">個人別</TabsTrigger>
              <TabsTrigger value="project">PJ別</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center border rounded-md">
            <Button
              variant={displayMode === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDisplayMode('calendar')}
            >
              <Calendar className="h-4 w-4" />
            </Button>
            <Button
              variant={displayMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDisplayMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {displayMode === 'calendar' ? (
        <Card>
          <CardContent className="pt-0">
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 border-b">
              {WEEKDAY_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`py-2 text-center text-xs font-medium ${
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[100px] border-b border-r p-1" />
              ))}
              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = formatDate(year, month, day)
                const dayOfWeek = (firstDay + i) % 7
                const dayShifts = shiftsByDate[dateStr] || []
                const isToday = dateStr === '2026-03-28'

                // Group by staff or project
                const grouped = viewMode === 'staff'
                  ? groupByKey(dayShifts, 'staffName')
                  : groupByKey(dayShifts, 'projectName')

                return (
                  <div
                    key={day}
                    className={`min-h-[100px] border-b border-r p-1 ${
                      isToday ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className={`text-xs font-medium mb-1 ${
                      dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''
                    }`}>
                      {isToday ? (
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-600 text-white text-[10px]">
                          {day}
                        </span>
                      ) : (
                        day
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {Object.entries(grouped).map(([groupLabel, shifts]) => (
                        <div key={groupLabel}>
                          {viewMode === 'staff' ? (
                            // By staff: show staff name, then project badges
                            <div className="text-[10px] leading-tight">
                              <span className="font-medium truncate block">{groupLabel}</span>
                              {shifts.map(shift => (
                                <span
                                  key={shift.id}
                                  className={`inline-block mt-0.5 mr-0.5 px-1 rounded text-[9px] border ${PROJECT_COLORS[shift.projectId] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                                >
                                  {shift.projectName} {shift.startTime}-{shift.endTime}
                                </span>
                              ))}
                            </div>
                          ) : (
                            // By project: show project name, then staff list
                            <div className="text-[10px] leading-tight">
                              <span className={`inline-block px-1 rounded text-[9px] border font-medium ${PROJECT_COLORS[shifts[0].projectId] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                {groupLabel}
                              </span>
                              {shifts.map(shift => (
                                <span key={shift.id} className="block text-muted-foreground truncate">
                                  {shift.staffName} {shift.startTime}-{shift.endTime}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* List View */
        <Card>
          <CardContent className="pt-0">
            {groupedByDate.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                この月のシフトデータはありません
              </div>
            ) : (
              <div className="space-y-6">
                {groupedByDate.map(([date, shifts]) => {
                  const d = new Date(date)
                  const dayOfWeek = WEEKDAY_LABELS[d.getDay()]
                  const dayNum = d.getDate()
                  const isToday = date === '2026-03-28'
                  return (
                    <div key={date}>
                      <div className={`flex items-center gap-2 mb-2 ${isToday ? 'text-blue-600' : ''}`}>
                        <span className="text-sm font-semibold">
                          {month}/{dayNum} ({dayOfWeek})
                        </span>
                        {isToday && (
                          <Badge variant="default" className="text-[10px] h-4">今日</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{shifts.length}件</span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>スタッフ</TableHead>
                            <TableHead>プロジェクト</TableHead>
                            <TableHead>時間</TableHead>
                            <TableHead>ソース</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shifts.map(shift => (
                            <TableRow key={shift.id}>
                              <TableCell className="font-medium">{shift.staffName}</TableCell>
                              <TableCell>
                                <span className={`inline-block px-1.5 py-0.5 rounded text-xs border ${PROJECT_COLORS[shift.projectId] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                  {shift.projectName}
                                </span>
                              </TableCell>
                              <TableCell>{shift.startTime} - {shift.endTime}</TableCell>
                              <TableCell>
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <RefreshCw className="h-3 w-3" />
                                  Google Calendar
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Utility: group array by key
function groupByKey<T extends Record<string, unknown>>(items: T[], key: string): Record<string, T[]> {
  const map: Record<string, T[]> = {}
  for (const item of items) {
    const k = String(item[key])
    if (!map[k]) map[k] = []
    map[k].push(item)
  }
  return map
}
