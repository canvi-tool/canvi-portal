'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import {
  PAYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from '@/lib/constants'
import type { PaymentCalculation } from '@/hooks/use-payments'

interface PaymentSummaryTableProps {
  data: PaymentCalculation[]
  loading?: boolean
  yearMonth?: string
}

export function PaymentSummaryTable({
  data,
  loading = false,
  yearMonth,
}: PaymentSummaryTableProps) {
  const columns: DataTableColumn<PaymentCalculation>[] = [
    {
      key: 'staff_name',
      header: 'スタッフ名',
      accessor: (row) => row.staff ? `${row.staff.last_name} ${row.staff.first_name}` : '',
      cell: (row) => {
        const staff = row.staff
        const ym = yearMonth || row.year_month
        return (
          <Link
            href={`/payments/${ym}/${row.staff_id}`}
            className="font-medium text-primary hover:underline"
          >
            {staff ? `${staff.last_name} ${staff.first_name}` : '(不明)'}
          </Link>
        )
      },
    },
    {
      key: 'employment_type',
      header: '雇用区分',
      accessor: (row) => row.staff?.employment_type ?? '',
      cell: (row) => {
        const type = row.staff?.employment_type ?? ''
        return (
          <Badge variant="outline">
            {EMPLOYMENT_TYPE_LABELS[type] ?? type}
          </Badge>
        )
      },
    },
    {
      key: 'total_amount',
      header: '総額',
      accessor: (row) => row.total_amount,
      cell: (row) => (
        <span className="font-mono font-medium">
          {row.total_amount.toLocaleString('ja-JP')}円
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'status',
      header: 'ステータス',
      accessor: (row) => row.status,
      cell: (row) => (
        <StatusBadge status={row.status} labels={PAYMENT_STATUS_LABELS} />
      ),
    },
    {
      key: 'calculated_at',
      header: '計算日時',
      accessor: (row) => row.calculated_at ?? '',
      cell: (row) =>
        row.calculated_at
          ? new Date(row.calculated_at).toLocaleString('ja-JP')
          : '-',
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      emptyMessage="支払い計算データがありません"
      keyExtractor={(row) => row.id}
      pageSize={20}
    />
  )
}
