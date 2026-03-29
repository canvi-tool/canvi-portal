'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search } from 'lucide-react'
import { StaffTable } from './staff-table'
import { STAFF_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS } from '@/lib/constants'
import type { Tables } from '@/lib/types/database'

type Staff = Tables<'staff'>

interface StaffListClientProps {
  initialData: Staff[]
}

export function StaffListClient({ initialData }: StaffListClientProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [employmentFilter, setEmploymentFilter] = useState<string | null>(null)

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
      result = result.filter((s) => s.status === statusFilter)
    }

    if (employmentFilter) {
      result = result.filter((s) => s.employment_type === employmentFilter)
    }

    return result
  }, [initialData, search, statusFilter, employmentFilter])

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
            <SelectValue placeholder="ステータス" />
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
            <SelectValue placeholder="雇用区分" />
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
      <StaffTable data={filteredData} />
    </div>
  )
}
