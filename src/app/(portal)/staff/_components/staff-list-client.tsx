'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { Search } from 'lucide-react'
import { StaffTable } from './staff-table'
import { BulkActionBar } from '@/components/shared/bulk-action-bar'
import { STAFF_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS } from '@/lib/constants'
import { useBulkUpdateStaffStatus } from '@/hooks/use-staff'
import { getEffectiveStatus } from './staff-status-badge'
import { toast } from 'sonner'
import type { Tables } from '@/lib/types/database'

type Staff = Tables<'staff'>

interface StaffListClientProps {
  initialData: Staff[]
}

const BULK_STATUS_OPTIONS = [
  { value: 'active', label: '稼働中に変更' },
  { value: 'on_leave', label: '休止中に変更' },
  { value: 'retired', label: '退職/離任に変更' },
]

export function StaffListClient({ initialData }: StaffListClientProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [employmentFilter, setEmploymentFilter] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const bulkUpdate = useBulkUpdateStaffStatus()

  const filteredData = useMemo(() => {
    let result = initialData

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((s) => {
        const fullName = `${s.last_name} ${s.first_name}`.toLowerCase()
        const fullNameKana = `${s.last_name_kana || ''} ${s.first_name_kana || ''}`.toLowerCase()
        const staffCode = (s.staff_code || '').toLowerCase()
        return (
          fullName.includes(q) ||
          fullNameKana.includes(q) ||
          s.email.toLowerCase().includes(q) ||
          staffCode.includes(q)
        )
      })
    }

    if (statusFilter) {
      result = result.filter((s) => {
        const cf = s.custom_fields as Record<string, unknown> | null
        return getEffectiveStatus(s.status, cf) === statusFilter
      })
    }

    if (employmentFilter) {
      result = result.filter((s) => s.employment_type === employmentFilter)
    }

    return result
  }, [initialData, search, statusFilter, employmentFilter])

  const handleBulkStatusChange = async (status: string) => {
    const ids = Array.from(selectedIds)
    try {
      const result = await bulkUpdate.mutateAsync({ ids, status })
      toast.success(`${result.updated}件のスタッフのステータスを更新しました`)
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
            <SelectValueWithLabel value={statusFilter} labels={STAFF_STATUS_LABELS} placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">すべて</SelectItem>
            {Object.entries(STAFF_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={employmentFilter}
          onValueChange={(val) => setEmploymentFilter(val || null)}
        >
          <SelectTrigger>
            <SelectValueWithLabel value={employmentFilter} labels={EMPLOYMENT_TYPE_LABELS} placeholder="雇用区分" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">すべて</SelectItem>
            {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <StaffTable
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
