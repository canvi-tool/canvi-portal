'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Phone,
  RefreshCw,
  Loader2,
  ExternalLink,
  Eye,
  VolumeOff,
  Volume2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

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
  | 'CALL_NO_SHIFT'
  | 'CALL_NO_ATTENDANCE'
  | 'CALL_NO_REPORT'

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

interface IgnoreRule {
  id: string
  alert_type: string
  staff_id: string | null
  project_id: string | null
  reason: string | null
  created_at: string
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
  CALL_NO_SHIFT: '架電あり・シフトなし',
  CALL_NO_ATTENDANCE: '架電あり・打刻なし',
  CALL_NO_REPORT: '架電あり・日報なし',
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
    case 'CALL_NO_SHIFT':
    case 'CALL_NO_ATTENDANCE':
    case 'CALL_NO_REPORT':
      return Phone
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
// localStorage helpers for persistent hidden state
// ---------------------------------------------------------------------------
const HIDDEN_ALERTS_KEY = 'canvi_hidden_alert_ids'

function loadHiddenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(HIDDEN_ALERTS_KEY)
    if (stored) return new Set(JSON.parse(stored))
  } catch { /* ignore */ }
  return new Set()
}

function saveHiddenIds(ids: Set<string>) {
  try {
    localStorage.setItem(HIDDEN_ALERTS_KEY, JSON.stringify([...ids]))
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Ignore rule matching (client-side mirror of server logic)
// ---------------------------------------------------------------------------
function isAlertMatchedByIgnore(
  rules: IgnoreRule[],
  alertType: string,
  staffId?: string | null,
  projectId?: string | null,
): IgnoreRule | undefined {
  return rules.find((rule) => {
    if (rule.alert_type !== alertType) return false
    if (rule.staff_id && rule.staff_id !== staffId) return false
    if (rule.project_id && rule.project_id !== projectId) return false
    return true
  })
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type ViewTab = 'active' | 'hidden' | 'ignored'

export default function AlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [staffFilter, setStaffFilter] = useState<string>('all')
  const [viewTab, setViewTab] = useState<ViewTab>('active')

  // Owner detection
  const [isOwner, setIsOwner] = useState(false)
  useEffect(() => {
    fetch('/api/user/current')
      .then((r) => r.json())
      .then((data) => {
        if (data.roles?.includes('owner')) setIsOwner(true)
      })
      .catch(() => {})
  }, [])

  // Hidden alerts (persisted in localStorage)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())

  // Ignore rules (persisted in DB, owner-only)
  const [ignoreRules, setIgnoreRules] = useState<IgnoreRule[]>([])
  // "All alerts" before ignore filtering (for showing in ignore tab)
  const [allAlertsBeforeIgnore, setAllAlertsBeforeIgnore] = useState<Alert[]>([])

  // Load hidden IDs from localStorage on mount
  useEffect(() => {
    setHiddenIds(loadHiddenIds())
  }, [])

  // Fetch ignore rules
  const fetchIgnoreRules = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts/ignores')
      if (res.ok) {
        const data: IgnoreRule[] = await res.json()
        setIgnoreRules(data)
      }
    } catch { /* ignore */ }
  }, [])

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

      // Clean up hidden IDs that no longer exist in current alerts (auto-resolved)
      const currentAlertIds = new Set(data.map((a) => a.id))
      setHiddenIds((prev) => {
        const cleaned = new Set([...prev].filter((id) => currentAlertIds.has(id)))
        if (cleaned.size !== prev.size) {
          saveHiddenIds(cleaned)
        }
        return cleaned
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Also fetch "all alerts" without ignore filtering for the ignore tab display
  // The derived API already filters out ignored ones, so we need a separate fetch
  // We'll use the alerts + reconstruct ignored ones from rules
  const fetchAllAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts/derived?include_ignored=1')
      if (res.ok) {
        const data: Alert[] = await res.json()
        setAllAlertsBeforeIgnore(data)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchAlerts()
    fetchIgnoreRules()
    fetchAllAlerts()
  }, [fetchAlerts, fetchIgnoreRules, fetchAllAlerts])

  const refresh = useCallback(() => {
    fetchAlerts()
    fetchIgnoreRules()
    fetchAllAlerts()
  }, [fetchAlerts, fetchIgnoreRules, fetchAllAlerts])

  // --- Unique filter options extracted from all alerts ---
  const allDisplayAlerts = viewTab === 'ignored' ? allAlertsBeforeIgnore : alerts

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of allDisplayAlerts) {
      if (a.relatedProjectId && a.relatedProjectName) {
        map.set(a.relatedProjectId, a.relatedProjectName)
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'ja'))
  }, [allDisplayAlerts])

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of allDisplayAlerts) {
      if (a.relatedStaffId && a.relatedStaffName) {
        map.set(a.relatedStaffId, a.relatedStaffName)
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'ja'))
  }, [allDisplayAlerts])

  // --- Derived data ---

  // Ignored alerts: alerts from allAlertsBeforeIgnore that match any ignore rule
  const ignoredAlerts = useMemo(() => {
    if (ignoreRules.length === 0) return []
    return allAlertsBeforeIgnore.filter((a) =>
      isAlertMatchedByIgnore(ignoreRules, a.type, a.relatedStaffId, a.relatedProjectId)
    )
  }, [allAlertsBeforeIgnore, ignoreRules])

  const activeAlerts = useMemo(() => {
    return alerts.filter((a) => !hiddenIds.has(a.id))
  }, [alerts, hiddenIds])

  const hiddenAlerts = useMemo(() => {
    return alerts.filter((a) => hiddenIds.has(a.id))
  }, [alerts, hiddenIds])

  const currentList = viewTab === 'active' ? activeAlerts : viewTab === 'hidden' ? hiddenAlerts : ignoredAlerts

  const filtered = useMemo(() => {
    return currentList.filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false
      if (projectFilter !== 'all' && a.relatedProjectId !== projectFilter) return false
      if (staffFilter !== 'all' && a.relatedStaffId !== staffFilter) return false
      return true
    })
  }, [currentList, typeFilter, severityFilter, projectFilter, staffFilter])

  const criticalCount = activeAlerts.filter((a) => a.severity === 'CRITICAL').length
  const warningCount = activeAlerts.filter((a) => a.severity === 'WARNING').length
  const infoCount = activeAlerts.filter((a) => a.severity === 'INFO').length

  // --- Actions ---

  function hideAlert(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev).add(id)
      saveHiddenIds(next)
      return next
    })
  }

  function unhideAlert(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      saveHiddenIds(next)
      return next
    })
  }

  function hideAll() {
    setHiddenIds((prev) => {
      const next = new Set(prev)
      for (const a of activeAlerts) next.add(a.id)
      saveHiddenIds(next)
      return next
    })
  }

  async function ignoreAlert(alert: Alert) {
    try {
      const res = await fetch('/api/alerts/ignores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_type: alert.type,
          staff_id: alert.relatedStaffId || null,
          project_id: alert.relatedProjectId || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '無視設定に失敗しました')
      }
      toast.success('このアラートパターンを無視に設定しました（通知対象外）')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '無視設定に失敗しました')
    }
  }

  async function unignoreAlert(alert: Alert) {
    const rule = isAlertMatchedByIgnore(ignoreRules, alert.type, alert.relatedStaffId, alert.relatedProjectId)
    if (!rule) return

    try {
      const res = await fetch('/api/alerts/ignores', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '無視解除に失敗しました')
      }
      toast.success('無視設定を解除しました（通知対象に復帰）')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '無視解除に失敗しました')
    }
  }

  // --- Render ---

  return (
    <div className="space-y-6">
      <PageHeader
        title="AIアラート"
        description="勤怠・日報・シフトの異常を自動検知して表示します（直近14日間）。解消されたアラートは自動で消えます。"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              更新
            </Button>
            {viewTab === 'active' && (
              <Button variant="outline" size="sm" onClick={hideAll} disabled={activeAlerts.length === 0}>
                <BellOff className="size-4" />
                全て非表示
              </Button>
            )}
          </div>
        }
      />

      {/* Active / Hidden / Ignored tabs */}
      <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as ViewTab)}>
        <TabsList>
          <TabsTrigger value="active" className="data-active:bg-white data-active:shadow-sm data-active:font-semibold">
            アクティブ
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
              {activeAlerts.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="hidden" className="data-active:bg-white data-active:shadow-sm data-active:font-semibold">
            非表示
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
              {hiddenAlerts.length}
            </span>
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="ignored" className="data-active:bg-white data-active:shadow-sm data-active:font-semibold">
              無視
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                {ignoredAlerts.length}
              </span>
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

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

        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger size="sm">
            <SelectValueWithLabel
              value={projectFilter}
              placeholder="PJで絞り込み"
              labels={{
                all: '全てのPJ',
                ...Object.fromEntries(projectOptions),
              }}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全てのPJ</SelectItem>
            {projectOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={staffFilter} onValueChange={setStaffFilter}>
          <SelectTrigger size="sm">
            <SelectValueWithLabel
              value={staffFilter}
              placeholder="スタッフで絞り込み"
              labels={{
                all: '全てのスタッフ',
                ...Object.fromEntries(staffOptions),
              }}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全てのスタッフ</SelectItem>
            {staffOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats summary (active tab only) */}
      {viewTab === 'active' && (
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
      )}

      {/* Ignored tab description */}
      {viewTab === 'ignored' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <VolumeOff className="inline size-4 mr-1.5 -mt-0.5" />
          無視されたアラートはSlack通知の対象から除外されます。解消されたアラートは自動で消えます。
        </div>
      )}

      {/* Error state */}
      {error && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4 text-destructive">
            <AlertTriangle className="size-5 shrink-0" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={refresh}>
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
              <p className="text-sm">
                {viewTab === 'active'
                  ? '該当するアラートはありません'
                  : viewTab === 'hidden'
                    ? '非表示のアラートはありません'
                    : '無視されたアラートはありません'}
              </p>
              <p className="text-xs mt-1">
                {viewTab === 'active'
                  ? '直近14日間に異常は検知されていません'
                  : viewTab === 'hidden'
                    ? '非表示にしたアラートが解消されると自動で消えます'
                    : '無視設定されたパターンに該当するアラートはありません'}
              </p>
            </CardContent>
          </Card>
        )}

        {filtered.map((alert) => {
          const Icon = typeIcon(alert.type)
          const isHidden = hiddenIds.has(alert.id)
          const isIgnored = viewTab === 'ignored'
          return (
            <Card key={alert.id} className={isHidden || isIgnored ? 'opacity-60' : ''}>
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
                    {isIgnored && (
                      <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                        <VolumeOff className="size-3 mr-1" />
                        通知OFF
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatTimestamp(alert.createdAt)}</span>
                    {alert.relatedStaffName && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {alert.relatedStaffName}
                      </span>
                    )}
                    {alert.relatedProjectName && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                        {alert.relatedProjectName}
                      </span>
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
                  {viewTab === 'ignored' ? (
                    /* 無視タブ: 無視解除ボタン */
                    <Button variant="ghost" size="sm" onClick={() => unignoreAlert(alert)} title="無視を解除（通知対象に復帰）">
                      <Volume2 className="size-3.5 mr-1" />
                      <span className="text-xs">解除</span>
                    </Button>
                  ) : isHidden ? (
                    /* 非表示タブ: 再表示ボタン */
                    <Button variant="ghost" size="sm" onClick={() => unhideAlert(alert.id)} title="再表示">
                      <Eye className="size-3.5" />
                    </Button>
                  ) : (
                    /* アクティブタブ: 非表示 + 無視ボタン */
                    <>
                      <Button variant="ghost" size="sm" onClick={() => hideAlert(alert.id)} title="非表示にする">
                        <BellOff className="size-3.5" />
                      </Button>
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => ignoreAlert(alert)}
                          title="無視する（通知対象から除外）"
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        >
                          <VolumeOff className="size-3.5" />
                        </Button>
                      )}
                    </>
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
