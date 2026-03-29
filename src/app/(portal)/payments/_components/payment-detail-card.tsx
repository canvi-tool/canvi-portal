'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  PAYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from '@/lib/constants'
import type { PaymentCalculationDetail } from '@/hooks/use-payments'

interface PaymentDetailCardProps {
  payment: PaymentCalculationDetail
}

export function PaymentDetailCard({ payment }: PaymentDetailCardProps) {
  const staff = payment.staff

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">支払い概要</CardTitle>
          <StatusBadge status={payment.status} labels={PAYMENT_STATUS_LABELS} />
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-muted-foreground">スタッフ名</dt>
            <dd className="text-sm font-medium">{staff ? `${staff.last_name} ${staff.first_name}` : '(不明)'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">雇用区分</dt>
            <dd className="text-sm">
              <Badge variant="outline">
                {EMPLOYMENT_TYPE_LABELS[staff?.employment_type ?? ''] ?? staff?.employment_type}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">対象年月</dt>
            <dd className="text-sm font-medium">{payment.year_month}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">支払総額</dt>
            <dd className="text-lg font-bold font-mono">
              {payment.total_amount.toLocaleString('ja-JP')}円
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">計算日時</dt>
            <dd className="text-sm">
              {payment.calculated_at
                ? new Date(payment.calculated_at).toLocaleString('ja-JP')
                : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">確定日時</dt>
            <dd className="text-sm">
              {payment.confirmed_at
                ? new Date(payment.confirmed_at).toLocaleString('ja-JP')
                : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">発行日時</dt>
            <dd className="text-sm">
              {payment.issued_at
                ? new Date(payment.issued_at).toLocaleString('ja-JP')
                : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">明細行数</dt>
            <dd className="text-sm">{payment.lines.length}件</dd>
          </div>
        </dl>
        {payment.notes && (
          <div className="mt-4 rounded-lg bg-muted p-3">
            <p className="text-sm text-muted-foreground">備考</p>
            <p className="text-sm mt-1">{payment.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
