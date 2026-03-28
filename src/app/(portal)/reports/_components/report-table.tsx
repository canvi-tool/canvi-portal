'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import { REPORT_STATUS_LABELS } from '@/lib/constants'
import type { WorkReport } from '@/hooks/use-reports'

interface ReportTableProps {
  data: WorkReport[]
  loading: boolean
  type: 'work' | 'performance'
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  submitted: 'secondary',
  approved: 'default',
  rejected: 'destructive',
}

export function ReportTable({ data, loading, type }: ReportTableProps) {
  const basePath = type === 'work' ? '/reports/work' : '/reports/performance'

  const columns: DataTableColumn<WorkReport>[] = [
    {
      key: 'year_month',
      header: '報告月',
      accessor: (row) => row.year_month,
      cell: (row) => (
        <Link
          href={`${basePath}/${row.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.year_month}
        </Link>
      ),
    },
    {
      key: 'staff_name',
      header: 'スタッフ名',
      accessor: (row) =>
        (row.staff as { full_name?: string } | null)?.full_name || '',
      cell: (row) => (
        <span>{(row.staff as { full_name?: string } | null)?.full_name || '不明'}</span>
      ),
    },
    {
      key: 'project_name',
      header: 'PJ名',
      accessor: (row) =>
        (row.project as { name?: string } | null)?.name || '',
      cell: (row) => (
        <span>{(row.project as { name?: string } | null)?.name || '未設定'}</span>
      ),
    },
    {
      key: 'total_hours',
      header: '勤務時間',
      accessor: (row) => row.total_hours,
      cell: (row) => <span>{row.total_hours}h</span>,
      className: 'text-right',
    },
    {
      key: 'status',
      header: 'ステータス',
      accessor: (row) => row.status,
      cell: (row) => (
        <Badge variant={STATUS_VARIANT[row.status] || 'outline'}>
          {REPORT_STATUS_LABELS[row.status] || row.status}
        </Badge>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      emptyMessage="報告データがありません"
      keyExtractor={(row) => row.id}
    />
  )
}
