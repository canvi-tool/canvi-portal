'use client'

import { useRouter } from 'next/navigation'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { CLIENT_STATUS_LABELS } from '@/lib/constants'
import type { Tables } from '@/lib/types/database'

type Client = Tables<'clients'>

interface ClientTableProps {
  data: Client[]
  loading?: boolean
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
}

export function ClientTable({ data, loading, selectable, selectedIds, onSelectionChange }: ClientTableProps) {
  const router = useRouter()

  const columns: DataTableColumn<Client>[] = [
    {
      key: 'client_code',
      header: 'クライアントコード',
      accessor: (row) => row.client_code || '',
      className: 'w-[160px]',
    },
    {
      key: 'name',
      header: 'クライアント名',
      accessor: (row) => row.name,
      cell: (row) => (
        <button
          className="text-left font-medium text-primary hover:underline"
          onClick={() => router.push(`/clients/${row.id}`)}
        >
          {row.name}
        </button>
      ),
    },
    {
      key: 'contact_person',
      header: '担当者',
      accessor: (row) => row.contact_person || '',
      className: 'hidden md:table-cell',
    },
    {
      key: 'industry',
      header: '業種',
      accessor: (row) => row.industry || '',
      cell: (row) => (
        row.industry ? (
          <Badge variant="outline">{row.industry}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      ),
      className: 'hidden lg:table-cell',
    },
    {
      key: 'status',
      header: 'ステータス',
      accessor: (row) => row.status,
      cell: (row) => (
        <StatusBadge status={row.status} labels={CLIENT_STATUS_LABELS} />
      ),
    },
    {
      key: 'contact_email',
      header: 'メール',
      accessor: (row) => row.contact_email || '',
      className: 'hidden lg:table-cell',
    },
  ]

  return (
    <DataTable<Client>
      columns={columns}
      data={data}
      loading={loading}
      emptyMessage="クライアントが登録されていません"
      keyExtractor={(row) => row.id}
      selectable={selectable}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
    />
  )
}
