'use client'

import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectValueWithLabel,
} from '@/components/ui/select'
import {
  Bell,
  BellOff,
  Check,
  Clock,
  AlertTriangle,
  FileX,
  CalendarX,
  UserMinus,
  Mail,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlertType =
  | 'unreported_work'
  | 'shift_discrepancy'
  | 'unsigned_contract'
  | 'failed_notification'
  | 'unsigned_retirement_doc'

type Severity = 'critical' | 'warning' | 'info'

interface Alert {
  id: string
  type: AlertType
  severity: Severity
  title: string
  message: string
  staffName: string
  createdAt: string
  isRead: boolean
  isResolved: boolean
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const INITIAL_ALERTS: Alert[] = [
  {
    id: '1',
    type: 'unreported_work',
    severity: 'warning',
    title: '勤務報告未提出',
    message: '田中太郎 - 2026年3月25日の勤務報告が未提出です',
    staffName: '田中太郎',
    createdAt: '2026-03-26T09:00:00',
    isRead: false,
    isResolved: false,
  },
  {
    id: '2',
    type: 'unsigned_contract',
    severity: 'critical',
    title: '契約書未締結',
    message: '佐藤花子 - 契約書の署名が1週間以上未完了です',
    staffName: '佐藤花子',
    createdAt: '2026-03-25T14:00:00',
    isRead: false,
    isResolved: false,
  },
  {
    id: '3',
    type: 'shift_discrepancy',
    severity: 'warning',
    title: 'シフト差異検知',
    message: '鈴木一郎 - 3月24日のシフトと実績に2時間の差異があります',
    staffName: '鈴木一郎',
    createdAt: '2026-03-25T10:00:00',
    isRead: true,
    isResolved: false,
  },
  {
    id: '4',
    type: 'failed_notification',
    severity: 'critical',
    title: '支払通知書送付失敗',
    message: '山田次郎への2月分支払通知書メール送付が失敗しました',
    staffName: '山田次郎',
    createdAt: '2026-03-24T16:00:00',
    isRead: true,
    isResolved: false,
  },
  {
    id: '5',
    type: 'unsigned_retirement_doc',
    severity: 'warning',
    title: '離任書類未締結',
    message: '高橋美咲 - 離任時誓約書の署名が未完了です',
    staffName: '高橋美咲',
    createdAt: '2026-03-24T11:00:00',
    isRead: false,
    isResolved: false,
  },
  {
    id: '6',
    type: 'unreported_work',
    severity: 'warning',
    title: '勤務報告未提出',
    message: '渡辺健太 - 2026年3月24日の勤務報告が未提出です',
    staffName: '渡辺健太',
    createdAt: '2026-03-25T09:00:00',
    isRead: true,
    isResolved: true,
  },
  {
    id: '7',
    type: 'shift_discrepancy',
    severity: 'info',
    title: 'シフト差異（軽微）',
    message: '伊藤さくら - 3月23日のシフトと実績に15分の差異があります',
    staffName: '伊藤さくら',
    createdAt: '2026-03-24T10:00:00',
    isRead: true,
    isResolved: true,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<AlertType, string> = {
  unreported_work: '未報告通知',
  shift_discrepancy: 'シフト差異通知',
  unsigned_contract: '契約未締結通知',
  failed_notification: '送付失敗通知',
  unsigned_retirement_doc: '離任書類未締結通知',
}

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: '重大',
  warning: '警告',
  info: '情報',
}

function typeIcon(type: AlertType) {
  switch (type) {
    case 'unreported_work':
      return Clock
    case 'shift_discrepancy':
      return CalendarX
    case 'unsigned_contract':
      return FileX
    case 'failed_notification':
      return Mail
    case 'unsigned_retirement_doc':
      return UserMinus
  }
}

function severityBadgeVariant(severity: Severity) {
  switch (severity) {
    case 'critical':
      return 'destructive' as const
    case 'warning':
      return 'secondary' as const
    case 'info':
      return 'outline' as const
  }
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHour = Math.floor(diffMs / 3_600_000)
  const diffDay = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'たった今'
  if (diffMin < 60) return `${diffMin}分前`
  if (diffHour < 24) return `${diffHour}時間前`
  if (diffDay < 7) return `${diffDay}日前`

  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | 'unread' | 'unresolved' | 'resolved'

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // --- Derived data ---

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false
      if (statusFilter === 'unread' && a.isRead) return false
      if (statusFilter === 'unresolved' && a.isResolved) return false
      if (statusFilter === 'resolved' && !a.isResolved) return false
      return true
    })
  }, [alerts, typeFilter, severityFilter, statusFilter])

  const unreadCount = alerts.filter((a) => !a.isRead).length
  const unresolvedCount = alerts.filter((a) => !a.isResolved).length
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && !a.isResolved).length

  // --- Actions ---

  function markAllRead() {
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })))
  }

  function markRead(id: string) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)),
    )
  }

  function markResolved(id: string) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: true, isResolved: true } : a)),
    )
  }

  // --- Render ---

  return (
    <div className="space-y-6">
      <PageHeader
        title="アラート管理"
        description="システムアラートと通知の一覧を確認・管理します"
        actions={
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
            <BellOff className="size-4" />
            全て既読にする
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger size="sm">
            <SelectValueWithLabel value={typeFilter} placeholder="種類で絞り込み" labels={{ all: '全ての種類', ...TYPE_LABELS }} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ての種類</SelectItem>
            <SelectItem value="unreported_work">未報告通知</SelectItem>
            <SelectItem value="shift_discrepancy">シフト差異通知</SelectItem>
            <SelectItem value="unsigned_contract">契約未締結通知</SelectItem>
            <SelectItem value="failed_notification">送付失敗通知</SelectItem>
            <SelectItem value="unsigned_retirement_doc">離任書類未締結通知</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger size="sm">
            <SelectValueWithLabel value={severityFilter} placeholder="重要度で絞り込み" labels={{ all: '全ての重要度', ...SEVERITY_LABELS }} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ての重要度</SelectItem>
            <SelectItem value="critical">重大</SelectItem>
            <SelectItem value="warning">警告</SelectItem>
            <SelectItem value="info">情報</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger size="sm">
            <SelectValueWithLabel value={statusFilter} placeholder="ステータスで絞り込み" labels={{ all: '全て', unread: '未読', unresolved: '未解決', resolved: '解決済' }} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            <SelectItem value="unread">未読</SelectItem>
            <SelectItem value="unresolved">未解決</SelectItem>
            <SelectItem value="resolved">解決済</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats summary */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Bell className="size-4 text-muted-foreground" />
          <span>
            未読 <span className="font-semibold">{unreadCount}件</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="size-4 text-muted-foreground" />
          <span>
            未解決 <span className="font-semibold">{unresolvedCount}件</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileX className="size-4 text-destructive" />
          <span>
            重大 <span className="font-semibold text-destructive">{criticalCount}件</span>
          </span>
        </div>
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Check className="mb-2 size-8" />
              <p className="text-sm">該当するアラートはありません</p>
            </CardContent>
          </Card>
        )}

        {filtered.map((alert) => {
          const Icon = typeIcon(alert.type)
          return (
            <Card
              key={alert.id}
              className={
                alert.isResolved
                  ? 'opacity-60'
                  : !alert.isRead
                    ? 'border-primary/30 bg-primary/[0.02]'
                    : undefined
              }
            >
              <CardContent className="flex items-start gap-4 py-4">
                {/* Icon */}
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                    alert.severity === 'critical'
                      ? 'bg-destructive/10 text-destructive'
                      : alert.severity === 'warning'
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                        : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                  }`}
                >
                  <Icon className="size-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Unread dot */}
                    {!alert.isRead && (
                      <span className="size-2 shrink-0 rounded-full bg-primary" />
                    )}
                    <span className="text-sm font-medium">{alert.title}</span>
                    <Badge variant={severityBadgeVariant(alert.severity)}>
                      {SEVERITY_LABELS[alert.severity]}
                    </Badge>
                    <Badge variant="outline">{TYPE_LABELS[alert.type]}</Badge>
                    {alert.isResolved && (
                      <Badge variant="default">
                        <Check className="size-3" />
                        解決済
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatTimestamp(alert.createdAt)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  {!alert.isRead && (
                    <Button variant="ghost" size="sm" onClick={() => markRead(alert.id)}>
                      <BellOff className="size-3.5" />
                      既読にする
                    </Button>
                  )}
                  {!alert.isResolved && (
                    <Button variant="ghost" size="sm" onClick={() => markResolved(alert.id)}>
                      <Check className="size-3.5" />
                      解決済にする
                    </Button>
                  )}
                  <Button variant="ghost" size="sm">
                    詳細を見る
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
