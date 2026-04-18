'use client'

import { useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export type AuditLogRow = {
  id: string
  createdAt: string
  userName: string | null
  userEmail: string | null
  serviceSlug: string
  serviceName: string
  event: string
  ipAddress: string | null
  errorMessage: string | null
}

export type ServiceOption = {
  slug: string
  name: string
}

const EVENT_LABELS: Record<string, string> = {
  sso_launch: 'SSO起動',
  access_denied: 'アクセス拒否',
  sso_error: 'エラー',
}

function EventBadge({ event }: { event: string }) {
  const label = EVENT_LABELS[event] ?? event
  if (event === 'sso_launch') {
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{label}</Badge>
  }
  if (event === 'access_denied') {
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{label}</Badge>
  }
  if (event === 'sso_error') {
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{label}</Badge>
  }
  return <Badge variant="secondary">{label}</Badge>
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

export function AuditLogsTable({ rows, services }: { rows: AuditLogRow[]; services: ServiceOption[] }) {
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [eventFilter, setEventFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (serviceFilter !== 'all' && r.serviceSlug !== serviceFilter) return false
      if (eventFilter !== 'all' && r.event !== eventFilter) return false
      return true
    })
  }, [rows, serviceFilter, eventFilter])

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">サービス</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="all">すべて</option>
              {services.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">イベント</label>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="all">すべて</option>
              <option value="sso_launch">SSO起動</option>
              <option value="access_denied">アクセス拒否</option>
              <option value="sso_error">エラー</option>
            </select>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">{filtered.length} 件表示</div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[170px]">日時</TableHead>
              <TableHead>ユーザー</TableHead>
              <TableHead>メール</TableHead>
              <TableHead>サービス</TableHead>
              <TableHead>イベント</TableHead>
              <TableHead>IPアドレス</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  該当するログがありません
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{formatDate(r.createdAt)}</TableCell>
                  <TableCell>{r.userName ?? '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.userEmail ?? '-'}</TableCell>
                  <TableCell>{r.serviceName}</TableCell>
                  <TableCell>
                    <EventBadge event={r.event} />
                    {r.errorMessage && (
                      <div className="text-[11px] text-red-600 mt-1">{r.errorMessage}</div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.ipAddress ?? '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
