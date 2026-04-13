'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PaymentDetailCard } from '../../_components/payment-detail-card'
import { PaymentStatusWorkflow } from '../../_components/payment-status-workflow'
import { PjBreakdownTable } from '../../_components/pj-breakdown-table'
import {
  usePayments,
  usePaymentDetail,
  useUpdatePayment,
  useConfirmPayment,
} from '@/hooks/use-payments'
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Plus,
  Undo2,
  Loader2,
  Download,
} from 'lucide-react'

interface PageProps {
  params: { yearMonth: string; staffId: string }
}

export default function StaffPaymentDetailPage({ params }: PageProps) {
  const { yearMonth, staffId } = params
  const router = useRouter()

  // staff_id + yearMonth でpayment を特定するために一覧から検索
  const { data: payments, isLoading: listLoading } = usePayments({ yearMonth })

  const paymentId = useMemo(() => {
    if (!payments) return null
    const found = payments.find((p) => p.staff_id === staffId)
    return found?.id ?? null
  }, [payments, staffId])

  const {
    data: payment,
    isLoading: detailLoading,
  } = usePaymentDetail(paymentId ?? '')

  const updatePayment = useUpdatePayment(paymentId ?? '')
  const confirmPayment = useConfirmPayment(paymentId ?? '')

  // State
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [adjName, setAdjName] = useState('')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjDetail, setAdjDetail] = useState('')
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'confirm' | 'reject' | 'issue'>('confirm')

  const [year, month] = yearMonth.split('-')
  const displayYearMonth = `${year}年${parseInt(month)}月`

  const isLoading = listLoading || detailLoading

  // 手動調整の追加
  const handleAddAdjustment = async () => {
    const amount = Number(adjAmount)
    if (!adjName || isNaN(amount)) {
      toast.error('ルール名と金額は必須です')
      return
    }

    try {
      await updatePayment.mutateAsync({
        adjustments: [
          {
            rule_name: adjName,
            amount,
            detail: adjDetail || undefined,
          },
        ],
      })
      toast.success('調整を追加しました')
      setAdjustDialogOpen(false)
      setAdjName('')
      setAdjAmount('')
      setAdjDetail('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '調整の追加に失敗しました')
    }
  }

  // 確定/差戻し/発行
  const handleConfirmAction = async () => {
    try {
      await confirmPayment.mutateAsync(confirmAction)
      const actionLabels = {
        confirm: '確定',
        reject: '差戻し',
        issue: '発行',
      }
      toast.success(`${actionLabels[confirmAction]}しました`)
      setConfirmDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作に失敗しました')
    }
  }

  // PDF生成（新しいタブで開く）
  const handleGeneratePdf = () => {
    if (!paymentId) return
    window.open(`/api/payments/${paymentId}/pdf`, '_blank')
  }

  // PDFダウンロード
  const handleDownloadPdf = async () => {
    if (!paymentId) return
    try {
      const res = await fetch(`/api/payments/${paymentId}/pdf`)
      if (!res.ok) throw new Error('PDF生成に失敗しました')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const staffName = payment?.staff ? `${payment.staff.last_name}${payment.staff.first_name}` : ''
      a.download = `支払通知書_${staffName}_${yearMonth}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('PDFのダウンロードに失敗しました')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="card" rows={1} />
        <LoadingSkeleton variant="table" />
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="space-y-6">
        <PageHeader title="支払い計算が見つかりません" />
        <Button variant="outline" onClick={() => router.push(`/payments/${yearMonth}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          一覧に戻る
        </Button>
      </div>
    )
  }

  const staff = payment.staff
  const canEdit =
    payment.status !== 'confirmed' && payment.status !== 'issued'
  const canConfirm =
    payment.status === 'aggregated' || payment.status === 'needs_review'
  const canReject =
    payment.status === 'confirmed' || payment.status === 'needs_review'
  const canIssue = payment.status === 'confirmed'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${staff ? `${staff.last_name} ${staff.first_name}` : '(不明)'} - ${displayYearMonth}`}
        description="支払い計算の詳細と操作"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/payments/${yearMonth}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              一覧に戻る
            </Button>
            {canEdit && (
              <Button variant="outline" onClick={() => setAdjustDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                修正
              </Button>
            )}
            {canReject && (
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmAction('reject')
                  setConfirmDialogOpen(true)
                }}
              >
                <Undo2 className="h-4 w-4 mr-1" />
                差戻し
              </Button>
            )}
            {canConfirm && (
              <Button
                onClick={() => {
                  setConfirmAction('confirm')
                  setConfirmDialogOpen(true)
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                確定
              </Button>
            )}
            {canIssue && (
              <Button
                onClick={() => {
                  setConfirmAction('issue')
                  setConfirmDialogOpen(true)
                }}
              >
                <FileText className="h-4 w-4 mr-1" />
                発行
              </Button>
            )}
            {(payment.status === 'confirmed' || payment.status === 'issued') && (
              <>
                <Button variant="outline" onClick={handleGeneratePdf}>
                  <FileText className="h-4 w-4 mr-1" />
                  支払通知書PDF
                </Button>
                <Button variant="outline" onClick={handleDownloadPdf}>
                  <Download className="h-4 w-4 mr-1" />
                  ダウンロード
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Status Workflow */}
      <Card>
        <CardContent className="py-4">
          <PaymentStatusWorkflow currentStatus={payment.status} />
        </CardContent>
      </Card>

      {/* Payment Detail Card */}
      <PaymentDetailCard payment={payment} />

      {/* PJ Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>明細一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <PjBreakdownTable
            lines={payment.lines}
            totalAmount={payment.total_amount}
          />
        </CardContent>
      </Card>

      {/* 手動調整ダイアログ */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>手動調整の追加</DialogTitle>
            <DialogDescription>
              支払い金額に手動で調整を加えます。マイナス値で控除も可能です。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                ルール名 <span className="text-destructive">*</span>
              </Label>
              <Input
                value={adjName}
                onChange={(e) => setAdjName(e.target.value)}
                placeholder="例: 交通費精算"
              />
            </div>
            <div className="space-y-2">
              <Label>
                金額 (円) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="例: 5000 (マイナスで控除)"
              />
            </div>
            <div className="space-y-2">
              <Label>備考</Label>
              <Textarea
                value={adjDetail}
                onChange={(e) => setAdjDetail(e.target.value)}
                placeholder="調整の理由を入力"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose className={buttonVariants({ variant: 'outline' })}>
              キャンセル
            </DialogClose>
            <Button
              onClick={handleAddAdjustment}
              disabled={updatePayment.isPending}
            >
              {updatePayment.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 確定/差戻し/発行ダイアログ */}
      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title={
          confirmAction === 'confirm'
            ? '支払い確定'
            : confirmAction === 'reject'
              ? '差戻し'
              : '支払い発行'
        }
        description={
          confirmAction === 'confirm'
            ? `${staff ? `${staff.last_name} ${staff.first_name}` : '(不明)'}の${displayYearMonth}支払い (${payment.total_amount.toLocaleString('ja-JP')}円) を確定しますか？`
            : confirmAction === 'reject'
              ? `${staff ? `${staff.last_name} ${staff.first_name}` : '(不明)'}の${displayYearMonth}支払いを差戻しますか？再計算が必要になる場合があります。`
              : `${staff ? `${staff.last_name} ${staff.first_name}` : '(不明)'}の${displayYearMonth}支払い通知を発行しますか？`
        }
        confirmLabel={
          confirmAction === 'confirm'
            ? '確定する'
            : confirmAction === 'reject'
              ? '差戻す'
              : '発行する'
        }
        onConfirm={handleConfirmAction}
        destructive={confirmAction === 'reject'}
      />
    </div>
  )
}
