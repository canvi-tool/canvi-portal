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
import { ClientTable } from './client-table'
import { CLIENT_STATUS_LABELS } from '@/lib/constants'
import type { Tables } from '@/lib/types/database'

type Client = Tables<'clients'>

interface ClientListClientProps {
  initialData: Client[]
}

export function ClientListClient({ initialData }: ClientListClientProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

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
            {Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <ClientTable data={filteredData} />
    </div>
  )
}
