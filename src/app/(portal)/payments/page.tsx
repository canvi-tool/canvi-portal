'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  const { data: payments, isLoading } = usePayments({
    yearMonth,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })

  // サマリー計算
  const summary = useMemo(() => {
    if (!payments) return { total: 0, totalAmount: 0, confirmed: 0, pending: 0 }

    return {
      total: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + p.total_amount, 0),
      confirmed: payments.filter(
        (p) => p.status === 'confirmed' || p.status === 'issued'
      ).length,
      pending: payments.filter(
        (p) => p.status !== 'confirmed' && p.status !== 'issued'
      ).length,
    }
  }, [payments])

  return (
    <div className="space-y-6">
      <PageHeader
        title="支払管理"
        description="スタッフへの支払い計算と管理を行います"
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/payments/${yearMonth}`} className={buttonVariants({ variant: "outline" })}>
              月次詳細
            </Link>
            <Link href="/payments/calculate" className={buttonVariants()}>
              <Calculator className="h-4 w-4 mr-1" />
              月次計算実行
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="w-48">
          <Select value={yearMonth} onValueChange={setYearMonth}>
            <SelectTrigger>
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
            <SelectTrigger>
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
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">対象者数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}名</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総支払額</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {summary.totalAmount.toLocaleString('ja-JP')}円
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">確定済</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.confirmed}名</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">未確定</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.pending}名</div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Table */}
      {isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : (
        <PaymentSummaryTable
          data={payments ?? []}
          loading={isLoading}
          yearMonth={yearMonth}
        />
      )}
    </div>
  )
}
