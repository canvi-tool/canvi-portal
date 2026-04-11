'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { PaymentSummaryTable } from './_components/payment-summary-table'
import { usePayments } from '@/hooks/use-payments'
import { PAYMENT_STATUS_LABELS } from '@/lib/constants'
import {
  Calculator,
  Users,
  Wallet,
  CheckCircle2,
  Clock,
  Search,
  FileDown,
} from 'lucide-react'

/**
 * 年月選択肢を生成する（現在月から12ヶ月前まで）
 */
function generateYearMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
    options.push({ value, label })
  }

  return options
}

export default function PaymentsPage() {
  const yearMonthOptions = useMemo(() => generateYearMonthOptions(), [])
  const [yearMonth, setYearMonth] = useState(yearMonthOptions[0].value)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const { data: payments, isLoading } = usePayments({
    yearMonth,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })

  // サマリー計算（single pass）
  const summary = useMemo(() => {
    if (!payments) return { total: 0, totalAmount: 0, confirmed: 0, pending: 0, confirmedAmount: 0, pendingAmount: 0 }

    let totalAmount = 0, confirmed = 0, confirmedAmount = 0, pending = 0, pendingAmount = 0
    for (const p of payments) {
      totalAmount += p.total_amount
      if (p.status === 'confirmed' || p.status === 'issued') {
        confirmed++
        confirmedAmount += p.total_amount
      } else {
        pending++
        pendingAmount += p.total_amount
      }
    }
    return { total: payments.length, totalAmount, confirmed, pending, confirmedAmount, pendingAmount }
  }, [payments])

  // 検索フィルタリング
  const filteredPayments = useMemo(() => {
    if (!payments || !search) return payments ?? []
    const lower = search.toLowerCase()
    return payments.filter((p) => {
      const staff = p.staff as { last_name?: string; first_name?: string; last_name_kana?: string; first_name_kana?: string } | null
      if (!staff) return false
      const name = `${staff.last_name ?? ''} ${staff.first_name ?? ''} ${staff.last_name_kana ?? ''} ${staff.first_name_kana ?? ''}`
      return name.toLowerCase().includes(lower)
    })
  }, [payments, search])

  const displayYearMonth = yearMonthOptions.find(o => o.value === yearMonth)?.label ?? yearMonth

  return (
    <div className="space-y-6">
      <PageHeader
        title="支払通知書"
        description="スタッフへの支払通知書の作成・確定・発行"
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/payments/${yearMonth}`} className={buttonVariants({ variant: "outline" })}>
              <FileDown className="h-4 w-4 mr-1" />
              月次詳細
            </Link>
            <Link href="/payments/calculate" className={buttonVariants()}>
              <Calculator className="h-4 w-4 mr-1" />
              月次計算実行
            </Link>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4" role="region" aria-label="支払サマリー">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">支払総額</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {summary.totalAmount.toLocaleString('ja-JP')}円
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {displayYearMonth} / {summary.total}名
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">対象者数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}名</div>
            <p className="text-xs text-muted-foreground mt-1">
              アクティブスタッフ
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">確定済</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.confirmed}名</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.confirmedAmount.toLocaleString('ja-JP')}円
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">未確定</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.pending}名</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.pendingAmount.toLocaleString('ja-JP')}円
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-48">
          <Select value={yearMonth} onValueChange={setYearMonth}>
            <SelectTrigger aria-label="年月を選択">
              <SelectValue placeholder="年月を選択" />
            </SelectTrigger>
            <SelectContent>
              {yearMonthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="ステータスで絞り込み">
              <SelectValueWithLabel value={statusFilter} placeholder="ステータス" labels={{ all: '全て', ...PAYMENT_STATUS_LABELS }} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全て</SelectItem>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="スタッフ名で検索..."
            aria-label="支払通知書を検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Payment Table */}
      {isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : (
        <PaymentSummaryTable
          data={filteredPayments}
          yearMonth={yearMonth}
        />
      )}
    </div>
  )
}
