'use client'

import { useRouter } from 'next/navigation'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import { StaffStatusBadge } from './staff-status-badge'
import { Badge } from '@/components/ui/badge'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/constants'
import type { Tables } from '@/lib/types/database'

type Staff = Tables<'staff'>

interface StaffTableProps {
  data: Staff[]
  loading?: boolean
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
}

export function StaffTable({ data, loading, selectable, selectedIds, onSelectionChange }: StaffTableProps) {
  const router = useRouter()

  const columns: DataTableColumn<Staff>[] = [
    {
      key: 'staff_code',
      header: 'スタッフコード',
      accessor: (row) => row.staff_code || '',
      className: 'w-[140px]',
    },
    {
      key: 'name',
      header: '名前',
      accessor: (row) => `${row.last_name} ${row.first_name}`,
      cell: (row) => (
        <button
          className="text-left font-medium text-primary hover:underline"
          onClick={() => router.push(`/staff/${row.id}`)}
        >
          {row.last_name} {row.first_name}
        </button>
      ),
    },
    {
      key: 'employment_type',
      header: '雇用区分',
      accessor: (row) => row.employment_type,
      cell: (row) => (
        <Badge variant="outline">
          {EMPLOYMENT_TYPE_LABELS[row.employment_type] ?? row.employment_type}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'ステータス',
      accessor: (row) => row.status,
      cell: (row) => <StaffStatusBadge status={row.status} />,
    },
    {
      key: 'email',
      header: 'メール',
      accessor: (row) => row.email,
      className: 'hidden md:table-cell',
    },
    {
      key: 'hire_date',
      header: '入職日',
      accessor: (row) => row.hire_date,
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.hire_date || '-'}
        </span>
      ),
      className: 'hidden lg:table-cell w-[120px]',
    },
  ]

  return (
    <DataTable<Staff>
      columns={columns}
      data={data}
      loading={loading}
      emptyMessage="スタッフが登録されていません"
      pageSize={20}
      keyExtractor={(row) => row.id}
      selectable={selectable}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
    />
  )
}
