'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { INVOICE_STATUS_LABELS } from '@/lib/constants'
import {
  Plus,
  Search,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Send,
  TrendingUp,
} from 'lucide-react'

// --- Types ---
type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

interface Invoice {
  id: string
  invoice_number: string
  project_name: string
  client_name: string
  amount: number
  tax_amount: number
  total_amount: number
  status: InvoiceStatus
  issued_at: string
  due_date: string
  paid_at: string | null
}

// --- Demo Data ---
const demoInvoices: Invoice[] = [
  {
    id: 'inv-001',
    invoice_number: 'INV-2026-001',
    project_name: 'Webリニューアル',
    client_name: '株式会社ABC商事',
    amount: 1250000,
    tax_amount: 125000,
    total_amount: 1375000,
    status: 'paid',
    issued_at: '2026-03-01',
    due_date: '2026-03-31',
    paid_at: '2026-03-28',
  },
  {
    id: 'inv-002',
    invoice_number: 'INV-2026-002',
    project_name: 'Webリニューアル',
    client_name: '株式会社ABC商事',
    amount: 1250000,
    tax_amount: 125000,
    total_amount: 1375000,
    status: 'sent',
    issued_at: '2026-03-15',
    due_date: '2026-04-15',
    paid_at: null,
  },
  {
    id: 'inv-003',
    invoice_number: 'INV-2026-003',
    project_name: 'SNSマーケ運用',
    client_name: '合同会社デジタルフロント',
    amount: 850000,
    tax_amount: 85000,
    total_amount: 935000,
    status: 'draft',
    issued_at: '',
    due_date: '',
    paid_at: null,
  },
  {
    id: 'inv-004',
    invoice_number: 'INV-2026-004',
    project_name: '業務システム開発',
    client_name: '株式会社テクノソリューション',
    amount: 2900000,
    tax_amount: 290000,
    total_amount: 3190000,
    status: 'overdue',
    issued_at: '2026-02-01',
    due_date: '2026-02-28',
    paid_at: null,
  },
  {
    id: 'inv-005',
    invoice_number: 'INV-2026-005',
    project_name: 'ECサイト構築',
    client_name: '株式会社ネクストステージ',
    amount: 1600000,
    tax_amount: 160000,
    total_amount: 1760000,
    status: 'sent',
    issued_at: '2026-03-20',
    due_date: '2026-04-20',
    paid_at: null,
  },
  {
    id: 'inv-006',
    invoice_number: 'INV-2026-006',
    project_name: 'アプリ開発',
    client_name: '株式会社イノベーションラボ',
    amount: 2250000,
    tax_amount: 225000,
    total_amount: 2475000,
    status: 'cancelled',
    issued_at: '2026-01-15',
    due_date: '2026-02-15',
    paid_at: null,
  },
]

// --- Helper ---
const formatCurrency = (value: number) =>
  `¥${value.toLocaleString('ja-JP')}`

// --- Column definitions (static, outside component) ---
const columns: DataTableColumn<Invoice>[] = [
  {
    key: 'invoice_number',
    header: '請求番号',
    accessor: (row) => row.invoice_number,
    cell: (row) => (
      <Link
        href={`/documents/invoices/${row.id}`}
        className="font-mono text-sm text-primary hover:underline"
      >
        {row.invoice_number}
      </Link>
    ),
  },
  {
    key: 'project_name',
    header: 'プロジェクト',
    accessor: (row) => row.project_name,
    cell: (row) => <span className="font-medium">{row.project_name}</span>,
  },
  {
    key: 'client_name',
    header: 'クライアント',
    accessor: (row) => row.client_name,
  },
  {
    key: 'total_amount',
    header: '請求額（税込）',
    accessor: (row) => row.total_amount,
    cell: (row) => (
      <div className="text-right">
        <span className="font-mono font-medium">{formatCurrency(row.total_amount)}</span>
        <span className="block text-xs text-muted-foreground">
          (税抜 {formatCurrency(row.amount)})
        </span>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'ステータス',
    accessor: (row) => row.status,
    cell: (row) => (
      <StatusBadge
        status={row.status}
        labels={INVOICE_STATUS_LABELS}
        variants={{
          paid: 'default',
          sent: 'secondary',
          draft: 'outline',
          overdue: 'destructive',
          cancelled: 'outline',
        }}
      />
    ),
  },
  {
    key: 'issued_at',
    header: '発行日',
    accessor: (row) => row.issued_at,
    cell: (row) =>
      row.issued_at ? (
        <span>{row.issued_at.replace(/-/g, '/')}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    key: 'due_date',
    header: '支払期限',
    accessor: (row) => row.due_date,
    cell: (row) => {
      if (!row.due_date) return <span className="text-muted-foreground">-</span>
      // Compare date strings to avoid timezone issues
      const today = new Date().toISOString().slice(0, 10)
      const isOverdue = row.status === 'overdue' || (row.status === 'sent' && row.due_date < today)
      return (
        <span className={isOverdue ? 'text-destructive font-medium' : ''}>
          {row.due_date.replace(/-/g, '/')}
        </span>
      )
    },
  },
]

// --- Component ---
export default function InvoicesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Filtered data
  const filtered = useMemo(() => {
    let data: Invoice[] = demoInvoices
    if (search) {
      const lower = search.toLowerCase()
      data = data.filter(
        (d) =>
          d.invoice_number.toLowerCase().includes(lower) ||
          d.project_name.toLowerCase().includes(lower) ||
          d.client_name.toLowerCase().includes(lower)
      )
    }
    if (statusFilter !== 'all') {
      data = data.filter((d) => d.status === statusFilter)
    }
    return data
  }, [search, statusFilter])

  // Summary calculations
  const summary = useMemo(() => {
    const all = demoInvoices
    const paidAmount = all
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + i.total_amount, 0)
    const unpaidAmount = all
      .filter((i) => i.status === 'sent' || i.status === 'overdue')
      .reduce((sum, i) => sum + i.total_amount, 0)
    const overdueAmount = all
      .filter((i) => i.status === 'overdue')
      .reduce((sum, i) => sum + i.total_amount, 0)

    return {
      total: all.length,
      totalAmount: all.reduce((sum, i) => sum + i.total_amount, 0),
      paidAmount,
      unpaidAmount,
      overdueCount: all.filter((i) => i.status === 'overdue').length,
      overdueAmount,
      sent: all.filter((i) => i.status === 'sent').length,
      draft: all.filter((i) => i.status === 'draft').length,
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="請求書"
        description="請求書の発行・送付・入金管理"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/documents/invoices/auto" className={buttonVariants({ variant: 'outline' })}>
              <TrendingUp className="h-4 w-4 mr-1" />
              自動作成
            </Link>
            <Link href="/documents/invoices/new" className={buttonVariants()}>
              <Plus className="h-4 w-4 mr-1" />
              新規作成
            </Link>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">請求総額</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatCurrency(summary.totalAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.total}件の請求書
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">入金済</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatCurrency(summary.paidAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              回収率 {summary.totalAmount > 0 ? Math.round((summary.paidAmount / summary.totalAmount) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">未入金</CardTitle>
            <Send className="h-4 w-4 text-blue-600" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatCurrency(summary.unpaidAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.sent}件 送付済
            </p>
          </CardContent>
        </Card>
        <Card className={summary.overdueCount > 0 ? 'border-destructive/50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">支払遅延</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${summary.overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${summary.overdueCount > 0 ? 'text-destructive' : ''}`}>
              {formatCurrency(summary.overdueAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.overdueCount}件 遅延中
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="請求番号、PJ名、クライアント名で検索..."
            aria-label="請求書を検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? 'all')}>
          <SelectTrigger className="w-40" aria-label="ステータスで絞り込み">
            <SelectValueWithLabel
              value={statusFilter}
              labels={{ all: 'すべて', ...INVOICE_STATUS_LABELS }}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage="条件に一致する請求書が見つかりません"
        keyExtractor={(row) => row.id}
      />
    </div>
  )
}
