'use client'

import { useMemo } from 'react'
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
  Wallet,
  Bell,
  Briefcase,
  AlertTriangle,
  FileText,
  CalendarDays,
  ClipboardList,
  Clock,
  TrendingUp,
  TrendingDown,
  Phone,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  BarChart3,
  UserPlus,
  Calculator,
} from 'lucide-react'

// --- Demo Data ---

const TODAY = (() => {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
})()

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABELS[d.getDay()]})`
}

function formatRelativeDate(dateStr: string): string {
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date(TODAY + 'T00:00:00')
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '今日'
  if (diffDays === 1) return '昨日'
  if (diffDays < 7) return `${diffDays}日前`
  return formatDateShort(dateStr)
}

// KPI
const KPI_DATA = {
  staffCount: { value: 42, prev: 39, label: 'スタッフ数' },
  activeProjects: { value: 12, prev: 10, label: '進行中PJ' },
  monthlyPayment: { value: 8_350_000, prev: 7_890_000, label: '今月の支払見込' },
  unresolvedAlerts: { value: 5, prev: 8, label: '未処理アラート' },
}

// Today's shifts
const TODAYS_SHIFTS = [
  { id: 's1', staffName: '佐藤 健太', projectName: 'PJ-Alpha', startTime: '09:00', endTime: '13:00', status: 'APPROVED' as const },
  { id: 's2', staffName: '田中 太郎', projectName: 'PJ-Alpha', startTime: '09:00', endTime: '18:00', status: 'APPROVED' as const },
  { id: 's3', staffName: '鈴木 一郎', projectName: 'PJ-Beta', startTime: '10:00', endTime: '19:00', status: 'SUBMITTED' as const },
  { id: 's4', staffName: '佐藤 健太', projectName: 'PJ-Beta', startTime: '14:00', endTime: '18:00', status: 'APPROVED' as const },
  { id: 's5', staffName: '山田 花子', projectName: 'PJ-Gamma', startTime: '09:00', endTime: '17:00', status: 'APPROVED' as const },
  { id: 's6', staffName: '高橋 めぐみ', projectName: 'PJ-Alpha', startTime: '13:00', endTime: '22:00', status: 'DRAFT' as const },
  { id: 's7', staffName: '渡辺 健太', projectName: 'PJ-Gamma', startTime: '10:00', endTime: '15:00', status: 'SUBMITTED' as const },
]

// Recent alerts
const RECENT_ALERTS = [
  { id: '1', type: '未報告', message: '田中太郎 - 3月26日の勤務報告が未提出', severity: 'warning' as const, createdAt: TODAY },
  { id: '2', type: '契約未締結', message: '佐藤花子 - 契約書の署名が1週間未完了', severity: 'critical' as const, createdAt: (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })() },
  { id: '3', type: 'シフト差異', message: '鈴木一郎 - 3月25日のシフトと実績に2h差異', severity: 'warning' as const, createdAt: (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })() },
  { id: '4', type: '異常検知', message: 'PJ-Alphaの稼働時間が前月比150%超過', severity: 'info' as const, createdAt: (() => { const d = new Date(); d.setDate(d.getDate() - 2); return d.toISOString().split('T')[0] })() },
  { id: '5', type: '送付失敗', message: '山田次郎への支払通知書メール送付失敗', severity: 'critical' as const, createdAt: (() => { const d = new Date(); d.setDate(d.getDate() - 3); return d.toISOString().split('T')[0] })() },
]

// Recent activity feed
const ACTIVITY_FEED = [
  { id: 'a1', action: '勤務報告を承認', actor: '田中 美咲', target: '佐藤健太 (3/27)', time: '10分前', icon: 'approve' as const },
  { id: 'a2', action: 'シフトを登録', actor: '高橋 めぐみ', target: 'PJ-Alpha (3/29-4/2)', time: '25分前', icon: 'shift' as const },
  { id: 'a3', action: '契約書を送付', actor: '岡林 優治', target: '新規スタッフ: 伊藤大輔', time: '1時間前', icon: 'contract' as const },
  { id: 'a4', action: '支払計算を実行', actor: 'システム', target: '2026年3月分 (42名)', time: '2時間前', icon: 'payment' as const },
  { id: 'a5', action: 'スタッフを登録', actor: '田中 美咲', target: '伊藤 大輔 (業務委託)', time: '3時間前', icon: 'staff' as const },
  { id: 'a6', action: '勤務報告を提出', actor: '鈴木 一郎', target: '3/27 PJ-Gamma 8h', time: '4時間前', icon: 'report' as const },
]

// Pending actions
const PENDING_ACTIONS = [
  { id: '1', type: 'report' as const, label: '勤務報告承認', count: 7, description: '未承認の報告が7件あります', href: '/reports/work', color: 'bg-orange-500' },
  { id: '2', type: 'shift' as const, label: 'シフト申請確認', count: 3, description: '承認待ちのシフトが3件', href: '/shifts/pending', color: 'bg-blue-500' },
  { id: '3', type: 'payment' as const, label: '3月分支払確認', count: 5, description: '未確定の支払が5件', href: '/payments', color: 'bg-violet-500' },
  { id: '4', type: 'contract' as const, label: '契約書署名待ち', count: 2, description: '署名待ちの契約が2件', href: '/contracts', color: 'bg-emerald-500' },
]

// Performance mini stats
const PROJECT_STATS = [
  { name: 'PJ-Alpha', calls: 342, appts: 28, revenue: 2_450_000, trend: 12 },
  { name: 'PJ-Beta', calls: 198, appts: 15, revenue: 1_280_000, trend: -3 },
  { name: 'PJ-Gamma', calls: 267, appts: 22, revenue: 1_890_000, trend: 8 },
]

// --- Components ---

const SHIFT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '下書き', color: 'bg-gray-400' },
  SUBMITTED: { label: '申請中', color: 'bg-amber-400' },
  APPROVED: { label: '承認済', color: 'bg-green-400' },
  REJECTED: { label: '却下', color: 'bg-red-400' },
}

function KpiCard({
  label,
  value,
  prevValue,
  icon: Icon,
  format,
  invertTrend,
  href,
}: {
  label: string
  value: number
  prevValue: number
  icon: React.ElementType
  format?: 'currency' | 'number'
  invertTrend?: boolean
  href: string
}) {
  const formatted = format === 'currency'
    ? `${(value / 10000).toFixed(0)}万円`
    : value.toLocaleString('ja-JP')

  const diff = value - prevValue
  const pct = prevValue > 0 ? Math.round((diff / prevValue) * 100) : 0
  const isPositive = invertTrend ? diff <= 0 : diff >= 0

  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold tracking-tight">{formatted}</div>
          <div className="flex items-center gap-1 mt-1">
            {isPositive ? (
              <TrendingUp className="h-3 w-3 text-green-600" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span className={cn('text-xs font-medium', isPositive ? 'text-green-600' : 'text-red-500')}>
              {pct >= 0 ? '+' : ''}{pct}%
            </span>
            <span className="text-xs text-muted-foreground">前月比</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function ActivityIcon({ type }: { type: string }) {
  const base = 'h-4 w-4'
  switch (type) {
    case 'approve': return <CheckCircle2 className={cn(base, 'text-green-600')} />
    case 'shift': return <CalendarDays className={cn(base, 'text-blue-600')} />
    case 'contract': return <FileText className={cn(base, 'text-violet-600')} />
    case 'payment': return <Calculator className={cn(base, 'text-amber-600')} />
    case 'staff': return <UserPlus className={cn(base, 'text-emerald-600')} />
    case 'report': return <ClipboardList className={cn(base, 'text-orange-600')} />
    default: return <Clock className={cn(base, 'text-gray-400')} />
  }
}

function severityVariant(severity: string) {
  switch (severity) {
    case 'critical': return 'destructive' as const
    case 'warning': return 'secondary' as const
    default: return 'outline' as const
  }
}

export default function DashboardPage() {
  const { user, demoAccount, demoRole } = useAuth()
  const displayName = demoAccount?.name || user?.user_metadata?.full_name || user?.email || 'ユーザー'
  const isStaff = demoRole === 'staff'

  // Current time indicator for shift timeline
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // Sort shifts by start time
  const sortedShifts = useMemo(() =>
    [...TODAYS_SHIFTS].sort((a, b) => {
      const [ah, am] = a.startTime.split(':').map(Number)
      const [bh, bm] = b.startTime.split(':').map(Number)
      return (ah * 60 + am) - (bh * 60 + bm)
    }),
    []
  )

  // Greeting based on time
  const greeting = currentHour < 12 ? 'おはようございます' : currentHour < 18 ? 'お疲れ様です' : 'お疲れ様です'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}、${displayName}さん`}
        description={`${formatDateShort(TODAY)} の業務概要`}
      />

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={KPI_DATA.staffCount.label}
          value={KPI_DATA.staffCount.value}
          prevValue={KPI_DATA.staffCount.prev}
          icon={Users}
          href="/staff"
        />
        <KpiCard
          label={KPI_DATA.activeProjects.label}
          value={KPI_DATA.activeProjects.value}
          prevValue={KPI_DATA.activeProjects.prev}
          icon={Briefcase}
          href="/projects"
        />
        <KpiCard
          label={KPI_DATA.monthlyPayment.label}
          value={KPI_DATA.monthlyPayment.value}
          prevValue={KPI_DATA.monthlyPayment.prev}
          icon={Wallet}
          format="currency"
          href="/payments"
        />
        <KpiCard
          label={KPI_DATA.unresolvedAlerts.label}
          value={KPI_DATA.unresolvedAlerts.value}
          prevValue={KPI_DATA.unresolvedAlerts.prev}
          icon={Bell}
          invertTrend
          href="/alerts"
        />
      </div>

      {/* Main grid: 2 columns on desktop */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* Left column: 3/5 width */}
        <div className="lg:col-span-3 space-y-6">

          {/* Today's Shifts */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4" />
                  本日のシフト
                  <Badge variant="outline" className="ml-1 font-normal">
                    {sortedShifts.length}件
                  </Badge>
                </CardTitle>
                <Link href="/shifts" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  全て表示 <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1.5">
                {sortedShifts.map((shift) => {
                  const [sh, sm] = shift.startTime.split(':').map(Number)
                  const [eh, em] = shift.endTime.split(':').map(Number)
                  const startMin = sh * 60 + sm
                  const endMin = eh * 60 + em
                  const isActive = currentMinutes >= startMin && currentMinutes < endMin
                  const isPast = currentMinutes >= endMin
                  const statusCfg = SHIFT_STATUS_CONFIG[shift.status]

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
                      {/* Time */}
                      <div className="w-[100px] shrink-0 font-mono text-xs text-muted-foreground">
                        {shift.startTime} - {shift.endTime}
                      </div>
                      {/* Status dot */}
                      <span className={cn('w-2 h-2 rounded-full shrink-0', statusCfg.color)} />
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{shift.staffName}</span>
                        <span className="text-muted-foreground mx-1.5">/</span>
                        <span className="text-muted-foreground">{shift.projectName}</span>
                      </div>
                      {/* Active indicator */}
                      {isActive && (
                        <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                          稼働中
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Project Performance */}
          {!isStaff && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4" />
                    今月のPJ実績
                  </CardTitle>
                  <Link href="/reports/performance" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                    詳細 <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {PROJECT_STATS.map((pj) => (
                    <div key={pj.name} className="flex items-center gap-4">
                      <div className="w-[90px] shrink-0">
                        <span className="text-sm font-medium">{pj.name}</span>
                      </div>
                      <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{pj.calls}件</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <CalendarCheck className="h-3 w-3" />
                          <span>{pj.appts}件</span>
                        </div>
                        <div className="font-medium font-mono">
                          {(pj.revenue / 10000).toFixed(0)}万
                        </div>
                      </div>
                      <div className={cn(
                        'flex items-center gap-0.5 text-xs font-medium w-[50px] justify-end',
                        pj.trend >= 0 ? 'text-green-600' : 'text-red-500'
                      )}>
                        {pj.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {pj.trend >= 0 ? '+' : ''}{pj.trend}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
              <div className="space-y-2">
                {RECENT_ALERTS.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-2.5 rounded-lg border p-2.5 text-sm"
                  >
                    <Badge variant={severityVariant(alert.severity)} className="shrink-0 text-[10px]">
                      {alert.type}
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
            </CardContent>
          </Card>
        </div>

        {/* Right column: 2/5 width */}
        <div className="lg:col-span-2 space-y-6">

          {/* Pending Actions */}
          {!isStaff && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" />
                  要対応
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {PENDING_ACTIONS.map((action) => (
                    <Link key={action.id} href={action.href}>
                      <div className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer">
                        <div className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold',
                          action.color
                        )}>
                          {action.count}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{action.label}</p>
                          <p className="text-xs text-muted-foreground">{action.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">クイックアクション</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2">
                <Link href="/reports/work/new">
                  <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1">
                    <ClipboardList className="h-4 w-4" />
                    <span className="text-xs">勤務報告</span>
                  </Button>
                </Link>
                <Link href="/shifts/new">
                  <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1">
                    <CalendarDays className="h-4 w-4" />
                    <span className="text-xs">シフト登録</span>
                  </Button>
                </Link>
                {!isStaff && (
                  <>
                    <Link href="/staff/new">
                      <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1">
                        <UserPlus className="h-4 w-4" />
                        <span className="text-xs">スタッフ登録</span>
                      </Button>
                    </Link>
                    <Link href="/payments/calculate">
                      <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1">
                        <Calculator className="h-4 w-4" />
                        <span className="text-xs">支払計算</span>
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">最近のアクティビティ</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {ACTIVITY_FEED.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <ActivityIcon type={activity.icon} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-relaxed">
                        <span className="font-medium">{activity.actor}</span>
                        <span className="text-muted-foreground"> が </span>
                        <span>{activity.action}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {activity.target}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                      {activity.time}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
