'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, Bell, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'

type Role = 'owner' | 'admin' | 'staff'

interface AlertDefinition {
  id: string
  category: string
  label: string
  default_severity: 'info' | 'warning' | 'critical'
  action_url_template: string | null
  sort_order: number
}

interface AlertSubscription {
  id: string
  alert_id: string
  role: Role
  channel_dashboard: boolean
  channel_slack: boolean
  channel_email: boolean
  enabled: boolean
  updated_by: string | null
  updated_at: string
}

interface ApiResponse {
  definitions: AlertDefinition[]
  subscriptions: AlertSubscription[]
}

const ROLES: Array<{ key: Role; label: string }> = [
  { key: 'owner', label: 'オーナー' },
  { key: 'admin', label: '管理者' },
  { key: 'staff', label: 'メンバー' },
]

const CATEGORY_LABELS: Record<string, string> = {
  A_self: 'A: 自分のタスク',
  B_approval: 'B: 承認待ち',
  C_anomaly: 'C: 異常検知',
  D_finance: 'D: 経理・スタッフ',
  E_config: 'E: 設定不備',
}

const SEVERITY_BADGE: Record<AlertDefinition['default_severity'], string> = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800',
}

// デフォルト購読 (seedと同期)
const DEFAULT_SUBS: Record<string, Record<Role, boolean>> = {
  shift_unsubmitted: { owner: true, admin: false, staff: true },
  attendance_missing_clock_in: { owner: false, admin: true, staff: true },
  correction_request_pending: { owner: true, admin: true, staff: false },
  shift_approval_pending: { owner: true, admin: true, staff: false },
  attendance_shift_diff: { owner: true, admin: true, staff: false },
  staff_missing_fields: { owner: true, admin: false, staff: false },
  pj_no_client: { owner: true, admin: false, staff: false },
  client_info_incomplete: { owner: true, admin: true, staff: false },
  pj_compensation_missing: { owner: true, admin: false, staff: false },
}

type SubKey = `${string}__${Role}`

function key(alertId: string, role: Role): SubKey {
  return `${alertId}__${role}` as SubKey
}

interface RowState {
  enabled: boolean
  channel_dashboard: boolean
  channel_slack: boolean
  channel_email: boolean
}

export default function AlertSubscriptionsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [definitions, setDefinitions] = useState<AlertDefinition[]>([])
  const [state, setState] = useState<Record<SubKey, RowState>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/alert-subscriptions', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 403) {
          toast.error('権限がありません（オーナー専用）')
        } else {
          toast.error('読み込みに失敗しました')
        }
        return
      }
      const data = (await res.json()) as ApiResponse
      setDefinitions(data.definitions)
      const next: Record<SubKey, RowState> = {}
      for (const s of data.subscriptions) {
        next[key(s.alert_id, s.role)] = {
          enabled: s.enabled,
          channel_dashboard: s.channel_dashboard,
          channel_slack: s.channel_slack,
          channel_email: s.channel_email,
        }
      }
      // 不足分を default で補完
      for (const d of data.definitions) {
        for (const r of ROLES) {
          const k = key(d.id, r.key)
          if (!next[k]) {
            next[k] = {
              enabled: DEFAULT_SUBS[d.id]?.[r.key] ?? false,
              channel_dashboard: true,
              channel_slack: false,
              channel_email: false,
            }
          }
        }
      }
      setState(next)
    } catch (e) {
      console.error(e)
      toast.error('読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const g: Record<string, AlertDefinition[]> = {}
    for (const d of definitions) {
      if (!g[d.category]) g[d.category] = []
      g[d.category].push(d)
    }
    return g
  }, [definitions])

  const toggleEnabled = (alertId: string, role: Role) => {
    setState((prev) => {
      const k = key(alertId, role)
      const cur = prev[k]
      if (!cur) return prev
      return { ...prev, [k]: { ...cur, enabled: !cur.enabled } }
    })
  }

  const resetToDefault = () => {
    const next: Record<SubKey, RowState> = {}
    for (const d of definitions) {
      for (const r of ROLES) {
        next[key(d.id, r.key)] = {
          enabled: DEFAULT_SUBS[d.id]?.[r.key] ?? false,
          channel_dashboard: true,
          channel_slack: false,
          channel_email: false,
        }
      }
    }
    setState(next)
    toast.info('デフォルトに戻しました（保存ボタンで確定）')
  }

  const save = async () => {
    setSaving(true)
    try {
      const items = definitions.flatMap((d) =>
        ROLES.map((r) => {
          const s = state[key(d.id, r.key)]
          return {
            alert_id: d.id,
            role: r.key,
            enabled: s?.enabled ?? false,
            channel_dashboard: s?.channel_dashboard ?? true,
            channel_slack: s?.channel_slack ?? false,
            channel_email: s?.channel_email ?? false,
          }
        })
      )
      const res = await fetch('/api/alert-subscriptions', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(err.error || '保存に失敗しました')
        return
      }
      toast.success('保存しました')
      await load()
    } catch (e) {
      console.error(e)
      toast.error('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="アラート購読設定"
        description="ロール（オーナー / 管理者 / メンバー）ごとに、ダッシュボードに表示するアラート種別を設定します。Slack / メール通知は Phase 2 で有効化予定です。"
      />

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={resetToDefault} disabled={loading || saving}>
          <RotateCcw className="mr-2 h-4 w-4" />
          デフォルトに戻す
        </Button>
        <Button onClick={save} disabled={loading || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          保存
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, defs]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  {CATEGORY_LABELS[category] || category}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-4 font-medium">アラート種別</th>
                        {ROLES.map((r) => (
                          <th key={r.key} className="py-2 px-3 font-medium text-center">
                            {r.label}
                            <div className="text-[10px] text-muted-foreground font-normal">ダッシュボード</div>
                          </th>
                        ))}
                        <th className="py-2 px-3 font-medium text-center text-muted-foreground">
                          Slack
                          <div className="text-[10px] font-normal">
                            <Badge variant="outline" className="text-[10px]">Phase 2</Badge>
                          </div>
                        </th>
                        <th className="py-2 px-3 font-medium text-center text-muted-foreground">
                          メール
                          <div className="text-[10px] font-normal">
                            <Badge variant="outline" className="text-[10px]">Phase 2</Badge>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {defs.map((d) => (
                        <tr key={d.id} className="border-b last:border-b-0">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span>{d.label}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${SEVERITY_BADGE[d.default_severity]}`}>
                                {d.default_severity}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{d.id}</div>
                          </td>
                          {ROLES.map((r) => {
                            const s = state[key(d.id, r.key)]
                            return (
                              <td key={r.key} className="py-3 px-3 text-center">
                                <Switch
                                  checked={s?.enabled ?? false}
                                  onCheckedChange={() => toggleEnabled(d.id, r.key)}
                                />
                              </td>
                            )
                          })}
                          <td className="py-3 px-3 text-center">
                            <Switch checked={false} disabled />
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Switch checked={false} disabled />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
