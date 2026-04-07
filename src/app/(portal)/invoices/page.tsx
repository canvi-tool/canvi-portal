'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { Plus, Search, Wallet, CheckCircle2, AlertTriangle, Send } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  issued: '発行済',
  sent: '送付済',
  paid: '入金済',
  overdue: '支払遅延',
  cancelled: 'キャンセル',
}

interface InvoiceListItem {
  id: string
  invoice_number: string
  status: string
  issue_date: string
  due_date: string
  subtotal: number
  tax_amount: number
  total_amount: number
  paid_amount: number
  project: { id: string; name: string } | null
  client: { id: string; name: string; email: string | null } | null
}

const formatCurrency = (v: number) => `¥${Number(v ?? 0).toLocaleString('ja-JP')}`

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [creating, setCreating] = useState(false)

  async function fetchInvoices() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/invoices?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '取得に失敗しました')
      setInvoices(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const filtered = useMemo(() => {
    if (!search) return invoices
    const lower = search.toLowerCase()
    return invoices.filter(
      (i) =>
        i.invoice_number.toLowerCase().includes(lower) ||
        i.project?.name?.toLowerCase().includes(lower) ||
        i.client?.name?.toLowerCase().includes(lower),
    )
  }, [invoices, search])

  const summary = useMemo(() => {
    const totalAmount = invoices.reduce((s, i) => s + Number(i.total_amount ?? 0), 0)
    const paidAmount = invoices
      .filter((i) => i.status === 'paid')
      .reduce((s, i) => s + Number(i.total_amount ?? 0), 0)
    const unpaidAmount = invoices
      .filter((i) => ['sent', 'issued', 'overdue'].includes(i.status))
      .reduce((s, i) => s + Number(i.total_amount ?? 0), 0)
    const overdue = invoices.filter((i) => i.status === 'overdue')
    return {
      total: invoices.length,
      totalAmount,
      paidAmount,
      unpaidAmount,
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, i) => s + Number(i.total_amount ?? 0), 0),
    }
  }, [invoices])

  const columns: DataTableColumn<InvoiceListItem>[] = [
    {
      key: 'invoice_number',
      header: '請求番号',
      accessor: (r) => r.invoice_number,
      cell: (r) => (
        <Link
          href={`/invoices/${r.id}`}
          className="font-mono text-sm text-primary hover:underline"
        >
          {r.invoice_number}
        </Link>
      ),
    },
    {
      key: 'project',
      header: 'プロジェクト',
      accessor: (r) => r.project?.name ?? '',
      cell: (r) => <span className="font-medium">{r.project?.name ?? '-'}</span>,
    },
    {
      key: 'client',
      header: 'クライアント',
      accessor: (r) => r.client?.name ?? '',
      cell: (r) => <span>{r.client?.name ?? '-'}</span>,
    },
    {
      key: 'total',
      header: '請求額（税込）',
      accessor: (r) => r.total_amount,
      cell: (r) => (
        <div className="text-right font-mono">{formatCurrency(r.total_amount)}</div>
      ),
    },
    {
      key: 'status',
      header: 'ステータス',
      accessor: (r) => r.status,
      cell: (r) => (
        <StatusBadge
          status={r.status}
          labels={STATUS_LABELS}
          variants={{
            paid: 'default',
            sent: 'secondary',
            issued: 'secondary',
            draft: 'outline',
            overdue: 'destructive',
            cancelled: 'outline',
          }}
        />
      ),
    },
    {
      key: 'issue',
      header: '発行日',
      accessor: (r) => r.issue_date,
      cell: (r) => <span>{r.issue_date?.replace(/-/g, '/') ?? '-'}</span>,
    },
    {
      key: 'due',
      header: '支払期限',
      accessor: (r) => r.due_date,
      cell: (r) => <span>{r.due_date?.replace(/-/g, '/') ?? '-'}</span>,
    },
  ]

  async function handleCreate() {
    // 簡易作成: モーダル代わりに prompt
    const projectId = window.prompt('プロジェクトID (UUID)')
    if (!projectId) return
    const clientId = window.prompt('クライアントID (UUID)')
    if (!clientId) return
    const periodStart = window.prompt('対象期間 開始 (YYYY-MM-DD)') ?? ''
    const periodEnd = window.prompt('対象期間 終了 (YYYY-MM-DD)') ?? ''
    if (!periodStart || !periodEnd) return

    setCreating(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          client_id: clientId,
          period_start: periodStart,
          period_end: periodEnd,
          auto_calculate: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '作成に失敗しました')
      await fetchInvoices()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'unknown')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="請求書"
        description="請求書の発行・送付・入金管理"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/settings/billing-rules"
              className={buttonVariants({ variant: 'outline' })}
            >
              請求ルール設定
            </Link>
            <Button onClick={handleCreate} disabled={creating}>
              <Plus className="h-4 w-4 mr-1" />
              自動生成
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">請求総額</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatCurrency(summary.totalAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{summary.total}件</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">入金済</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatCurrency(summary.paidAmount)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">未入金</CardTitle>
            <Send className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatCurrency(summary.unpaidAmount)}
            </div>
          </CardContent>
        </Card>
        <Card className={summary.overdueCount > 0 ? 'border-destructive/50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">支払遅延</CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${summary.overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${summary.overdueCount > 0 ? 'text-destructive' : ''}`}
            >
              {formatCurrency(summary.overdueAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.overdueCount}件 遅延中
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="請求番号 / PJ / クライアント検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-40">
            <SelectValueWithLabel
              value={statusFilter}
              labels={{ all: 'すべて', ...STATUS_LABELS }}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage={loading ? '読み込み中...' : '請求書がありません'}
        keyExtractor={(r) => r.id}
      />
    </div>
  )
}
