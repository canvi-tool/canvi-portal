'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/providers/auth-provider'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Users,
  Bell,
  Briefcase,
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  ChevronRight,
  Users as UsersIcon,
  Wallet,
  Loader2,
  FileWarning,
  Clock,
  UserPlus,
} from 'lucide-react'

// --- Helpers ---

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function todayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABELS[d.getDay()]})`
}

function formatRelativeDate(dateStr: string): string {
  const today = todayStr()
  const target = new Date(dateStr + 'T00:00:00')
  const todayDate = new Date(today + 'T00:00:00')
  const diffDays = Math.round((todayDate.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '今日'
  if (diffDays === 1) return '昨日'
  if (diffDays < 7) return `${diffDays}日前`
  return formatDateShort(dateStr)
}

// --- Types ---

interface PendingFormItem {
  id: string
  name: string
  type: 'onboarding' | 'info_update'
  requestedAt: string
  email: string
}

interface StaffMissingFields {
  id: string
  name: string
  employmentType: string
  missingFields: string[]
}

interface DashboardData {
  staffCount: number
  activeProjects: number
  unresolvedAlerts: number
  pendingForms: PendingFormItem[]
  staffMissingFields: StaffMissingFields[]
  todaysShifts: Array<{
    id: string
    staffName: string
    projectName: string
    startTime: string
    endTime: string
    status: string
    title?: string | null
  }>
  recentAlerts: Array<{
    id: string
    type: string
    message: string
    severity: string
    createdAt: string
  }>
  recentStaff: Array<{
    id: string
    name: string
    createdAt: string
  }>
}

// --- Data Fetching ---

async function fetchDashboardData(): Promise<DashboardData & { isOwner?: boolean }> {
  const res = await fetch('/api/dashboard')
  if (!res.ok) throw new Error('ダッシュボードデータの取得に失敗しました')
  return res.json()
}

// --- Components ---

const SHIFT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: '申請中', color: 'bg-amber-400' },
  APPROVED: { label: '承認済', color: 'bg-green-400' },
  NEEDS_REVISION: { label: '修正依頼', color: 'bg-orange-400' },
}

function KpiCard({
  label,
  value,
  icon: Icon,
  format,
  href,
}: {
  label: string
  value: number
  icon: React.ElementType
  format?: 'currency' | 'number'
  href: string
}) {
  const formatted = format === 'currency'
    ? `${(value / 10000).toFixed(0)}万円`
    : value.toLocaleString('ja-JP')

  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-3 pb-2.5 px-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="text-xl font-bold tracking-tight">{formatted}</div>
        </CardContent>
      </Card>
    </Link>
  )
}

function severityVariant(severity: string) {
  switch (severity) {
    case 'CRITICAL': return 'destructive' as const
    case 'WARNING': return 'secondary' as const
    default: return 'outline' as const
  }
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  CONTRACT_EXPIRY: '契約期限',
  SHIFT_ANOMALY: 'シフト差異',
  REPORT_OVERDUE: '未報告',
  PAYMENT_ISSUE: '支払',
  CUSTOM: 'その他',
  ATTENDANCE_ERROR: '勤怠エラー',
  ATTENDANCE_CORRECTION_PENDING: '勤怠修正依頼',
  REPORT_MISSING: '日報送付漏れ',
  REPORT_REJECTED: '日報差戻し',
  SHIFT_SUBMISSION_DUE: 'シフト未提出',
}

// --- Attendance Summary Card ---

function AttendanceSummaryCard() {
  const [summary, setSummary] = useState<{
    today: Array<{
      staff_id: string
      display_name: string
      status: string
      clock_in: string | null
      clock_out: string | null
      work_minutes: number | null
    }>
    summary: { total_staff: number; clocked_in: number; on_break: number; clocked_out: number; not_clocked_in: number }
  } | null>(null)

  useEffect(() => {
    fetch('/api/attendance/summary')
      .then(res => res.ok ? res.json() : null)
      .then(data => setSummary(data))
      .catch(() => {})
  }, [])

  if (!summary) return null

  const { summary: s, today } = summary

  const statusDot: Record<string, string> = {
    clocked_in: 'bg-green-500',
    on_break: 'bg-yellow-500',
    clocked_out: 'bg-blue-400',
    not_clocked_in: 'bg-gray-300',
  }

  const statusLabel: Record<string, string> = {
    clocked_in: '勤務中',
    on_break: '休憩中',
    clocked_out: '退勤済',
    not_clocked_in: '未出勤',
    modified: '修正済',
    approved: '承認済',
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            本日の勤怠状況
          </CardTitle>
          <Link href="/attendance" className="text-xs text-primary hover:underline flex items-center gap-0.5">
            詳細 <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* サマリーバー */}
        <div className="flex gap-4 mb-3 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            勤務中 <strong>{s.clocked_in}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            休憩中 <strong>{s.on_break}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            退勤済 <strong>{s.clocked_out}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gray-300" />
            未出勤 <strong>{s.not_clocked_in}</strong>
          </span>
        </div>

        {/* メンバーリスト（最大10件） */}
        {today.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">稼働中スタッフはいません</p>
        ) : (
          <div className="space-y-1.5">
            {today.slice(0, 10).map((member) => (
              <div key={member.staff_id} className="flex items-center gap-2 text-sm">
                <span className={cn('h-2 w-2 rounded-full shrink-0', statusDot[member.status] || 'bg-gray-300')} />
                <span className="font-medium truncate flex-1">{member.display_name}</span>
                <span className="text-muted-foreground text-xs">
                  {statusLabel[member.status] || member.status}
                </span>
                {member.clock_in && (
                  <span className="text-muted-foreground text-xs font-mono">
                    {new Date(member.clock_in).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}
                  </span>
                )}
              </div>
            ))}
            {today.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-1">他 {today.length - 10}名</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Main Page ---

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<(DashboardData & { isOwner?: boolean }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [effectiveName, setEffectiveName] = useState<string | null>(null)

  useEffect(() => {
    // インパーソネーション対応: サーバーから現在の有効ユーザー名を取得
    fetch('/api/staff/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        const ln = d.last_name || ''
        const fn = d.first_name || ''
        const name = `${ln} ${fn}`.trim()
        if (name) setEffectiveName(name)
      })
      .catch(() => {})
  }, [])

  const displayName = effectiveName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'ユーザー'

  useEffect(() => {
    fetchDashboardData()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const currentHour = now.getHours()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const greeting = currentHour < 12 ? 'おはようございます' : 'お疲れ様です'
  const today = todayStr()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const d = data || {
    staffCount: 0,
    activeProjects: 0,
    unresolvedAlerts: 0,
    pendingForms: [],
    staffMissingFields: [],
    todaysShifts: [],
    recentAlerts: [],
    recentStaff: [],
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${greeting}、${displayName}さん`}
        description={`${formatDateShort(today)} の業務概要`}
      />

      {/* KPI Cards */}
      <div className={cn('grid gap-2.5 grid-cols-2', d.isOwner ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
        {d.isOwner && (
          <KpiCard
            label="スタッフ数"
            value={d.staffCount}
            icon={Users}
            href="/staff"
          />
        )}
        <KpiCard
          label="進行中PJ"
          value={d.activeProjects}
          icon={Briefcase}
          href="/projects"
        />
        <KpiCard
          label="未処理アラート"
          value={d.unresolvedAlerts}
          icon={Bell}
          href="/alerts"
        />
        {d.isOwner && (
          <KpiCard
            label="未回答フォーム"
            value={d.pendingForms.length}
            icon={ClipboardList}
            href="/staff"
          />
        )}
      </div>

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-5">

        {/* Left column */}
        <div className="lg:col-span-3 space-y-4">

          {/* Today's Shifts */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4" />
                  本日のシフト
                  <Badge variant="outline" className="ml-1 font-normal">
                    {d.todaysShifts.length}件
                  </Badge>
                </CardTitle>
                <Link href="/shifts" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  全て表示 <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {d.todaysShifts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">本日のシフトはありません</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(
                    d.todaysShifts.reduce<Record<string, typeof d.todaysShifts>>((acc, s) => {
                      const key = s.projectName || '未分類'
                      if (!acc[key]) acc[key] = []
                      acc[key].push(s)
                      return acc
                    }, {})
                  )
                    .sort(([a], [b]) => a.localeCompare(b, 'ja'))
                    .map(([projectName, shifts]) => (
                      <div key={projectName}>
                        <div className="flex items-center gap-2 mb-1.5 px-1">
                          <span className="text-xs font-semibold text-muted-foreground">{projectName}</span>
                          <Badge variant="outline" className="text-[10px] font-normal h-4 px-1.5">
                            {shifts.length}件
                          </Badge>
                        </div>
                        <div className="space-y-1.5">
                          {shifts.map((shift) => {
                            const [sh, sm] = shift.startTime.split(':').map(Number)
                            const [eh, em] = shift.endTime.split(':').map(Number)
                            const startMin = sh * 60 + sm
                            const endMin = eh * 60 + em
                            const isActive = currentMinutes >= startMin && currentMinutes < endMin
                            const isPast = currentMinutes >= endMin
                            const statusCfg = SHIFT_STATUS_CONFIG[shift.status] || SHIFT_STATUS_CONFIG.SUBMITTED
                            return (
                              <div
                                key={shift.id}
                                className={cn(
                                  'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors',
                                  isActive && 'bg-blue-50/60 border-blue-200',
                                  isPast && 'opacity-50',
                                  !isActive && !isPast && 'hover:bg-muted/50'
                                )}
                              >
                                <div className="w-[100px] shrink-0 font-mono text-xs text-muted-foreground">
                                  {shift.startTime} - {shift.endTime}
                                </div>
                                <span className={cn('w-2 h-2 rounded-full shrink-0', statusCfg.color)} />
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium">{shift.staffName}</span>
                                  {shift.title && shift.title !== projectName && (
                                    <span className="ml-2 text-xs text-muted-foreground truncate">- {shift.title}</span>
                                  )}
                                </div>
                                {isActive && (
                                  <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                                    稼働中
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Today's Attendance (Owner/Admin only) */}
          {d.isOwner && <AttendanceSummaryCard />}

          {/* Recent Alerts */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4" />
                  最近のアラート
                </CardTitle>
                <Link href="/alerts" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  全て表示 <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {d.recentAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">アラートはありません</p>
              ) : (
                <div className="space-y-2">
                  {d.recentAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-2.5 rounded-lg border p-2.5 text-sm"
                    >
                      <Badge variant={severityVariant(alert.severity)} className="shrink-0 text-[10px]">
                        {ALERT_TYPE_LABELS[alert.type] || alert.type}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-tight">{alert.message}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                        {formatRelativeDate(alert.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">クイックアクション</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2">
                <Link href="/reports/work">
                  <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1">
                    <ClipboardList className="h-4 w-4" />
                    <span className="text-xs">日次報告</span>
                  </Button>
                </Link>
                <Link href="/shifts?openBulk=1">
                  <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1">
                    <CalendarDays className="h-4 w-4" />
                    <span className="text-xs">Canviカレンダー</span>
                  </Button>
                </Link>
                {d.isOwner && (
                  <Link href="/staff">
                    <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1">
                      <UsersIcon className="h-4 w-4" />
                      <span className="text-xs">スタッフ</span>
                    </Button>
                  </Link>
                )}
                {d.isOwner && (
                  <Link href="/payments">
                    <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1">
                      <Wallet className="h-4 w-4" />
                      <span className="text-xs">支払書</span>
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending Forms (オーナーのみ) */}
          {d.isOwner && d.pendingForms.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/10">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
                    <ClipboardList className="h-4 w-4" />
                    未回答フォーム
                    <Badge variant="secondary" className="ml-1 font-normal">
                      {d.pendingForms.length}件
                    </Badge>
                  </CardTitle>
                  <Link href="/staff" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                    スタッフ一覧 <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5">
                  {d.pendingForms.map((item) => (
                    <Link key={`${item.id}-${item.type}`} href={`/staff/${item.id}`}>
                      <div className="flex items-center justify-between rounded-lg border bg-white dark:bg-slate-900 px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{item.name}</span>
                          <Badge variant={item.type === 'onboarding' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                            {item.type === 'onboarding' ? '新規登録' : '情報更新'}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {item.requestedAt ? formatRelativeDate(item.requestedAt) : ''}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Staff Missing Required Fields (オーナーのみ) */}
          {d.isOwner && d.staffMissingFields.length > 0 && (
            <Card className="border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/10">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base text-red-700 dark:text-red-400">
                    <FileWarning className="h-4 w-4" />
                    必須項目の未入力
                    <Badge variant="destructive" className="ml-1 font-normal">
                      {d.staffMissingFields.length}名
                    </Badge>
                  </CardTitle>
                  <Link href="/staff" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                    スタッフ一覧 <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {d.staffMissingFields.map((item) => (
                    <Link key={item.id} href={`/staff/${item.id}`}>
                      <div className="rounded-lg border bg-white dark:bg-slate-900 px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {item.missingFields.length}件
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          {item.missingFields.join('、')}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recently Added Staff (オーナーのみ) */}
          {d.isOwner && <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserPlus className="h-4 w-4" />
                  最近登録されたスタッフ
                </CardTitle>
                <Link href="/staff" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  全て表示 <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {d.recentStaff.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">スタッフデータなし</p>
              ) : (
                <div className="space-y-2">
                  {d.recentStaff.map((staff) => (
                    <div key={staff.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span className="font-medium">{staff.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelativeDate(staff.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>}
        </div>
      </div>
    </div>
  )
}
