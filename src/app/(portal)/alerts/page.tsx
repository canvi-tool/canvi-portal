'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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
  Package,
  RefreshCw,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types (matches DerivedAlert from recent-alerts.ts)
// ---------------------------------------------------------------------------

type AlertType =
  | 'ATTENDANCE_ERROR'
  | 'ATTENDANCE_CORRECTION_PENDING'
  | 'REPORT_MISSING'
  | 'REPORT_REJECTED'
  | 'SHIFT_SUBMISSION_DUE'
  | 'EQUIPMENT_PLEDGE_UNSIGNED'

type Severity = 'CRITICAL' | 'WARNING' | 'INFO'

interface Alert {
  id: string
  type: AlertType
  severity: Severity
  title: string
  message: string
  description: string
  relatedStaffId?: string | null
  relatedStaffName?: string | null
  relatedProjectId?: string | null
  relatedProjectName?: string | null
  projectManagerName?: string | null
  createdAt: string
  href?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<AlertType, string> = {
  ATTENDANCE_ERROR: '勤怠エラー',
  ATTENDANCE_CORRECTION_PENDING: '勤怠修正依頼',
  REPORT_MISSING: '日報送付漏れ',
  REPORT_REJECTED: '日報差戻し',
  SHIFT_SUBMISSION_DUE: 'シフト未提出',
  EQUIPMENT_PLEDGE_UNSIGNED: '貸与品契約未締結',
}

const SEVERITY_LABELS: Record<Severity, string> = {
  CRITICAL: '重大',
  WARNING: '警告',
  INFO: '情報',
}

function typeIcon(type: AlertType) {
  switch (type) {
    case 'ATTENDANCE_ERROR':
      return Clock
    case 'ATTENDANCE_CORRECTION_PENDING':
      return FileX
    case 'REPORT_MISSING':
      return CalendarX
    case 'REPORT_REJECTED':
      return FileX
    case 'SHIFT_SUBMISSION_DUE':
      return CalendarX
    case 'EQUIPMENT_PLEDGE_UNSIGNED':
      return Package
  }
}

function severityBadgeVariant(severity: Severity) {
  switch (severity) {
    case 'CRITICAL':
      return 'destructive' as const
    case 'WARNING':
      return 'secondary' as const
    case 'INFO':
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

type StatusFilter = 'all' | 'critical' | 'warning' | 'info'

export default function AlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter] = useState<StatusFilter>('all')

  // Dismissed alerts (session-only)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  // Fetch alerts from API
  const fetchAlerts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/alerts/derived')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'アラートの取得に失敗しました')
      }
      const data: Alert[] = await res.json()
      setAlerts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  // --- Derived data ---

  const activeAlerts = useMemo(() => {
    return alerts.filter((a) => !dismissedIds.has(a.id))
  }, [alerts, dismissedIds])

  const filtered = useMemo(() => {
    return activeAlerts.filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false
      if (statusFilter !== 'all' && a.severity !== statusFilter.toUpperCase()) return false
      return true
    })
  }, [activeAlerts, typeFilter, severityFilter, statusFilter])

  const criticalCount = activeAlerts.filter((a) => a.severity === 'CRITICAL').length
  const warningCount = activeAlerts.filter((a) => a.severity === 'WARNING').length
  const infoCount = activeAlerts.filter((a) => a.severity === 'INFO').length

  // --- Actions ---

  function dismissAlert(id: string) {
    setDismissedIds((prev) => new Set(prev).add(id))
  }

  function dismissAll() {
    setDismissedIds(new Set(activeAlerts.map((a) => a.id)))
  }

  // --- Render ---

  return (
    <div className="space-y-6">
      <PageHeader
        title="AIアラート"
        description="勤怠・日報・シフトの異常を自動検知して表示します（直近14日間）"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchAlerts} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              更新
            </Button>
            <Button variant="outline" size="sm" onClick={dismissAll} disabled={activeAlerts.length === 0}>
              <BellOff className="size-4" />
              全て非表示
            </Button>
          </div>
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
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger size="sm">
            <SelectValueWithLabel value={severityFilter} placeholder="重要度で絞り込み" labels={{ all: '全ての重要度', ...SEVERITY_LABELS }} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ての重要度</SelectItem>
            <SelectItem value="CRITICAL">重大</SelectItem>
            <SelectItem value="WARNING">警告</SelectItem>
            <SelectItem value="INFO">情報</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats summary */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Bell className="size-4 text-muted-foreground" />
          <span>
            合計 <span className="font-semibold">{activeAlerts.length}件</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="size-4 text-destructive" />
          <span>
            重大 <span className="font-semibold text-destructive">{criticalCount}件</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="size-4 text-amber-500" />
          <span>
            警告 <span className="font-semibold text-amber-600">{warningCount}件</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Bell className="size-4 text-blue-500" />
          <span>
            情報 <span className="font-semibold text-blue-600">{infoCount}件</span>
          </span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4 text-destructive">
            <AlertTriangle className="size-5 shrink-0" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchAlerts}>
              再試行
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && alerts.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="size-6 animate-spin mr-2" />
            <p className="text-sm">アラートを取得中...</p>
          </CardContent>
        </Card>
      )}

      {/* Alert list */}
      <div className="space-y-3">
        {!isLoading && !error && filtered.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Check className="mb-2 size-8 text-green-500" />
              <p className="text-sm">該当するアラートはありません</p>
              <p className="text-xs mt-1">直近14日間に異常は検知されていません</p>
            </CardContent>
          </Card>
        )}

        {filtered.map((alert) => {
          const Icon = typeIcon(alert.type)
          return (
            <Card key={alert.id}>
              <CardContent className="flex items-start gap-4 py-4">
                {/* Icon */}
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                    alert.severity === 'CRITICAL'
                      ? 'bg-destructive/10 text-destructive'
                      : alert.severity === 'WARNING'
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                        : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                  }`}
                >
                  <Icon className="size-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{alert.title}</span>
                    <Badge variant={severityBadgeVariant(alert.severity)}>
                      {SEVERITY_LABELS[alert.severity]}
                    </Badge>
                    <Badge variant="outline">{TYPE_LABELS[alert.type]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatTimestamp(alert.createdAt)}</span>
                    {alert.relatedProjectName && (
                      <span>PJ: {alert.relatedProjectName}</span>
                    )}
                    {alert.projectManagerName && (
                      <span>管理者: {alert.projectManagerName}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  {alert.href && (
                    <Button variant="ghost" size="sm" onClick={() => router.push(alert.href!)}>
                      <ExternalLink className="size-3.5 mr-1" />
                      詳細
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => dismissAlert(alert.id)}>
                    <BellOff className="size-3.5" />
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
