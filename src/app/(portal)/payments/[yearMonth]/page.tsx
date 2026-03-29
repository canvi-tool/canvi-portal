'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PaymentSummaryTable } from '../_components/payment-summary-table'
import {
  usePayments,
  paymentKeys,
} from '@/hooks/use-payments'
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Users,
  Wallet,
  Clock,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

interface PageProps {
  params: { yearMonth: string }
}

export default function MonthDetailPage({ params }: PageProps) {
  const { yearMonth } = params
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: payments, isLoading } = usePayments({ yearMonth })

  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)
  const [batchAction, setBatchAction] = useState<'confirm' | 'issue'>('confirm')

  // 年月をフォーマット
  const [year, month] = yearMonth.split('-')
  const displayYearMonth = `${year}年${parseInt(month)}月`

  // サマリー
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

  // 一括確定の対象
  const confirmablePayments = useMemo(
    () =>
      (payments ?? []).filter(
        (p) => p.status === 'aggregated' || p.status === 'needs_review'
      ),
    [payments]
  )

  const issuablePayments = useMemo(
    () => (payments ?? []).filter((p) => p.status === 'confirmed'),
    [payments]
  )

  const handleBatchConfirm = async () => {
    const targets =
      batchAction === 'confirm' ? confirmablePayments : issuablePayments

    if (targets.length === 0) {
      toast.error('対象がありません')
      return
    }

    let successCount = 0
    let errorCount = 0

    for (const payment of targets) {
      try {
        const res = await fetch(`/api/payments/${payment.id}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: batchAction }),
        })
        if (res.ok) {
          successCount++
        } else {
          errorCount++
        }
      } catch {
        errorCount++
      }
    }

    queryClient.invalidateQueries({ queryKey: paymentKeys.lists() })
    setBatchConfirmOpen(false)

    if (errorCount > 0) {
      toast.warning(`${successCount}件成功、${errorCount}件失敗`)
    } else {
      toast.success(`${successCount}件を処理しました`)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${displayYearMonth} 支払一覧`}
        description={`${displayYearMonth}の支払い計算結果一覧`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/payments')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              支払管理に戻る
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setBatchAction('confirm')
                setBatchConfirmOpen(true)
              }}
              disabled={confirmablePayments.length === 0}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              一括確定 ({confirmablePayments.length}件)
            </Button>
            <Button
              onClick={() => {
                setBatchAction('issue')
                setBatchConfirmOpen(true)
              }}
              disabled={issuablePayments.length === 0}
            >
              <FileText className="h-4 w-4 mr-1" />
              一括発行 ({issuablePayments.length}件)
            </Button>
          </div>
        }
      />

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

      {/* Table */}
      {isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : (
        <PaymentSummaryTable
          data={payments ?? []}
          loading={isLoading}
          yearMonth={yearMonth}
        />
      )}

      {/* Batch Confirm Dialog */}
      <ConfirmDialog
        open={batchConfirmOpen}
        onOpenChange={setBatchConfirmOpen}
        title={batchAction === 'confirm' ? '一括確定' : '一括発行'}
        description={
          batchAction === 'confirm'
            ? `${confirmablePayments.length}件の支払いを確定しますか？`
            : `${issuablePayments.length}件の支払いを発行済みにしますか？`
        }
        confirmLabel={batchAction === 'confirm' ? '確定する' : '発行する'}
        onConfirm={handleBatchConfirm}
      />
    </div>
  )
}
