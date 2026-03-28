'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Phone,
  CalendarCheck,
  FileText,
  CheckCircle,
  Eye,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/layout/page-header'

// --- Demo Data ---

type DailyReportEntry = {
  projectName: string
  startTime: string | null
  endTime: string | null
  hours: number
  breakMinutes: number
  callCount: number
  appointmentCount: number
  qualitativeNote: string
}

type DailyReport = {
  id: string
  staffId: string
  staffName: string
  date: string
  status: 'draft' | 'submitted' | 'approved'
  entries: DailyReportEntry[]
}

const DEMO_DAILY_REPORTS: DailyReport[] = [
  {
    id: '1',
    staffId: '1',
    staffName: '田中太郎',
    date: '2026-03-28',
    status: 'submitted',
    entries: [
      {
        projectName: 'PJ-Alpha',
        startTime: '09:00',
        endTime: '13:00',
        hours: 4,
        breakMinutes: 0,
        callCount: 45,
        appointmentCount: 3,
        qualitativeNote:
          'クライアントA社との商談を実施。次回提案に向けた要件ヒアリング完了。',
      },
      {
        projectName: 'PJ-Beta',
        startTime: '14:00',
        endTime: '18:00',
        hours: 4,
        breakMinutes: 0,
        callCount: 30,
        appointmentCount: 1,
        qualitativeNote: '新規リスト50件に対してアプローチ開始。',
      },
    ],
  },
  {
    id: '2',
    staffId: '2',
    staffName: '佐藤花子',
    date: '2026-03-28',
    status: 'draft',
    entries: [
      {
        projectName: 'PJ-Alpha',
        startTime: '10:00',
        endTime: '19:00',
        hours: 8,
        breakMinutes: 60,
        callCount: 0,
        appointmentCount: 0,
        qualitativeNote:
          '開発タスク：認証モジュールの実装完了。テストコード作成中。',
      },
    ],
  },
  {
    id: '3',
    staffId: '5',
    staffName: '渡辺健太',
    date: '2026-03-28',
    status: 'approved',
    entries: [
      {
        projectName: 'PJ-Gamma',
        startTime: null,
        endTime: null,
        hours: 8,
        breakMinutes: 0,
        callCount: 0,
        appointmentCount: 0,
        qualitativeNote: '月額固定業務：経理処理・請求書発行対応。',
      },
    ],
  },
  {
    id: '4',
    staffId: '1',
    staffName: '田中太郎',
    date: '2026-03-27',
    status: 'approved',
    entries: [
      {
        projectName: 'PJ-Alpha',
        startTime: '09:00',
        endTime: '18:00',
        hours: 8,
        breakMinutes: 60,
        callCount: 52,
        appointmentCount: 4,
        qualitativeNote: 'B社との契約更新交渉。条件提示済み。',
      },
    ],
  },
  {
    id: '5',
    staffId: '2',
    staffName: '佐藤花子',
    date: '2026-03-27',
    status: 'approved',
    entries: [
      {
        projectName: 'PJ-Beta',
        startTime: '09:00',
        endTime: '18:00',
        hours: 8,
        breakMinutes: 60,
        callCount: 0,
        appointmentCount: 0,
        qualitativeNote: 'API設計のレビュー対応。フィードバック反映完了。',
      },
    ],
  },
  {
    id: '6',
    staffId: '3',
    staffName: '鈴木一郎',
    date: '2026-03-27',
    status: 'submitted',
    entries: [
      {
        projectName: 'PJ-Gamma',
        startTime: '10:00',
        endTime: '19:00',
        hours: 8,
        breakMinutes: 60,
        callCount: 68,
        appointmentCount: 5,
        qualitativeNote:
          '新規開拓架電。大手企業2社からの引き合いあり。',
      },
    ],
  },
]

const DEMO_STAFF = [
  { id: '1', name: '田中太郎' },
  { id: '2', name: '佐藤花子' },
  { id: '3', name: '鈴木一郎' },
  { id: '5', name: '渡辺健太' },
]

const DEMO_PROJECTS = [
  { id: 'pj-alpha', name: 'PJ-Alpha' },
  { id: 'pj-beta', name: 'PJ-Beta' },
  { id: 'pj-gamma', name: 'PJ-Gamma' },
]

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  draft: { label: '下書き', variant: 'outline' },
  submitted: { label: '提出済', variant: 'secondary' },
  approved: { label: '承認済', variant: 'default' },
}

// --- Helpers ---

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekDays = ['日', '月', '火', '水', '木', '金', '土']
  const weekDay = weekDays[d.getDay()]
  return `${month}月${day}日（${weekDay}）`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

// --- Component ---

export default function WorkReportsPage() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState('2026-03-28')
  const [filterStaff, setFilterStaff] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Filter reports
  const filtered = DEMO_DAILY_REPORTS.filter((r) => {
    if (r.date !== selectedDate) return false
    if (filterStaff && filterStaff !== 'all' && r.staffId !== filterStaff)
      return false
    if (filterStatus && filterStatus !== 'all' && r.status !== filterStatus)
      return false
    if (filterProject && filterProject !== 'all') {
      const hasProject = r.entries.some(
        (e) =>
          e.projectName.toLowerCase() ===
          DEMO_PROJECTS.find((p) => p.id === filterProject)?.name.toLowerCase()
      )
      if (!hasProject) return false
    }
    return true
  })

  // Stats
  const currentMonth = selectedDate.slice(0, 7)
  const monthlyReports = DEMO_DAILY_REPORTS.filter(
    (r) => r.date.startsWith(currentMonth)
  )
  const totalMonthly = monthlyReports.length
  const pendingApproval = monthlyReports.filter(
    (r) => r.status === 'submitted'
  ).length
  const todayReported = DEMO_DAILY_REPORTS.filter(
    (r) => r.date === selectedDate
  ).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="勤務報告"
        description="日次の勤務実績を打刻・報告します"
        actions={
          <Button
            size="sm"
            onClick={() => router.push('/reports/work/new')}
          >
            <Plus className="h-4 w-4 mr-1" />
            本日の報告を作成
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">今月の報告数</p>
              <p className="text-xl font-bold">{totalMonthly}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
              <Clock className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">未承認</p>
              <p className="text-xl font-bold">{pendingApproval}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
              <CalendarCheck className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">本日の報告済み</p>
              <p className="text-xl font-bold">{todayReported}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-[160px]"
          />
          <span className="text-sm font-medium">
            {formatDate(selectedDate)}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedDate('2026-03-28')}
        >
          今日
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs">スタッフ</Label>
          <Select value={filterStaff} onValueChange={setFilterStaff}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="全スタッフ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全スタッフ</SelectItem>
              {DEMO_STAFF.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">プロジェクト</Label>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="全プロジェクト" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全プロジェクト</SelectItem>
              {DEMO_PROJECTS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">ステータス</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="全ステータス" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全ステータス</SelectItem>
              <SelectItem value="draft">下書き</SelectItem>
              <SelectItem value="submitted">提出済</SelectItem>
              <SelectItem value="approved">承認済</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Report Cards */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>この日の報告はありません</p>
            </CardContent>
          </Card>
        )}

        {filtered.map((report) => {
          const statusCfg = STATUS_CONFIG[report.status]
          const totalHours = report.entries.reduce(
            (sum, e) => sum + e.hours,
            0
          )
          const totalCalls = report.entries.reduce(
            (sum, e) => sum + e.callCount,
            0
          )
          const totalAppts = report.entries.reduce(
            (sum, e) => sum + e.appointmentCount,
            0
          )

          return (
            <Card key={report.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>{report.staffName}</span>
                  <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                </CardTitle>
                <CardAction>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>合計 {totalHours}h</span>
                    {totalCalls > 0 && (
                      <>
                        <span className="mx-1">|</span>
                        <Phone className="h-3 w-3" />
                        <span>{totalCalls}件</span>
                      </>
                    )}
                    {totalAppts > 0 && (
                      <>
                        <span className="mx-1">|</span>
                        <CalendarCheck className="h-3 w-3" />
                        <span>{totalAppts}件</span>
                      </>
                    )}
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.entries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border bg-muted/30 p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {entry.projectName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.startTime && entry.endTime
                          ? `${entry.startTime} - ${entry.endTime}${entry.breakMinutes > 0 ? `（休憩${entry.breakMinutes}分）` : ''}`
                          : `${entry.hours}時間`}
                      </span>
                    </div>
                    {(entry.callCount > 0 || entry.appointmentCount > 0) && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {entry.callCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            架電 {entry.callCount}件
                          </span>
                        )}
                        {entry.appointmentCount > 0 && (
                          <span className="flex items-center gap-1">
                            <CalendarCheck className="h-3 w-3" />
                            アポ {entry.appointmentCount}件
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {truncate(entry.qualitativeNote, 80)}
                    </p>
                  </div>
                ))}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm">
                    <Eye className="h-3 w-3 mr-1" />
                    詳細
                  </Button>
                  {report.status === 'submitted' && (
                    <Button size="sm">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      承認
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
