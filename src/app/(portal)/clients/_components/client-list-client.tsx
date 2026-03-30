'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { Search } from 'lucide-react'
import { ClientTable } from './client-table'
import { BulkActionBar } from '@/components/shared/bulk-action-bar'
import { CLIENT_STATUS_LABELS } from '@/lib/constants'
import { useBulkUpdateClientStatus } from '@/hooks/use-clients'
import { toast } from 'sonner'
import type { Tables } from '@/lib/types/database'

type Client = Tables<'clients'>

interface ClientListClientProps {
  initialData: Client[]
}

const BULK_STATUS_OPTIONS = [
  { value: 'active', label: '有効に変更' },
  { value: 'inactive', label: '無効に変更' },
]

export function ClientListClient({ initialData }: ClientListClientProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const bulkUpdate = useBulkUpdateClientStatus()

  const filteredData = useMemo(() => {
    let result = initialData

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((c) => {
        const name = (c.name || '').toLowerCase()
        const nameKana = (c.name_kana || '').toLowerCase()
        const clientCode = (c.client_code || '').toLowerCase()
        const contactPerson = (c.contact_person || '').toLowerCase()
        const contactEmail = (c.contact_email || '').toLowerCase()
        return (
          name.includes(q) ||
          nameKana.includes(q) ||
          clientCode.includes(q) ||
          contactPerson.includes(q) ||
          contactEmail.includes(q)
        )
      })
    }

    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter)
    }

    return result
  }, [initialData, search, statusFilter])

  const handleBulkStatusChange = async (status: string) => {
    const ids = Array.from(selectedIds)
    try {
      const result = await bulkUpdate.mutateAsync({ ids, status })
      toast.success(`${result.updated}件のクライアントのステータスを更新しました`)
      setSelectedIds(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '一括更新に失敗しました')
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="名前・コードで検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val || null)}
        >
          <SelectTrigger>
            <SelectValueWithLabel value={statusFilter} labels={{ '': 'すべて', ...CLIENT_STATUS_LABELS }} placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">すべて</SelectItem>
            {Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <ClientTable
        data={filteredData}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={filteredData.length}
        onClearSelection={() => setSelectedIds(new Set())}
      >
        {BULK_STATUS_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant="secondary"
            size="sm"
            disabled={bulkUpdate.isPending}
            onClick={() => handleBulkStatusChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </BulkActionBar>
    </div>
  )
}
