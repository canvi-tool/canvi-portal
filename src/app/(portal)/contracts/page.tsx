'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, FileText } from 'lucide-react'
import { useContractList } from '@/hooks/use-contracts'
import { ContractStatusBadge } from './_components/contract-status-tracker'
import type { ContractStatus } from '@/lib/types/enums'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'すべて' },
  { value: 'draft', label: '下書き' },
  { value: 'pending_signature', label: '署名待ち' },
  { value: 'signed', label: '署名済み' },
  { value: 'active', label: '有効' },
  { value: 'expired', label: '期限切れ' },
  { value: 'terminated', label: '解約済み' },
]

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function ContractsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const { data, isLoading } = useContractList({
    search: debouncedSearch,
    status: statusFilter,
  })

  // Simple debounce for search
  const handleSearchChange = useMemo(() => {
    let timeout: NodeJS.Timeout
    return (value: string) => {
      setSearch(value)
      clearTimeout(timeout)
      timeout = setTimeout(() => setDebouncedSearch(value), 300)
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="契約管理"
        description="契約書の作成・管理・署名依頼"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/contracts/templates" />}>
              <FileText className="h-4 w-4 mr-2" />
              テンプレート
            </Button>
            <Button render={<Link href="/contracts/new" />}>
              <Plus className="h-4 w-4 mr-2" />
              新規作成
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="契約番号、スタッフ名、タイトルで検索..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>契約番号</TableHead>
              <TableHead>スタッフ名</TableHead>
              <TableHead>タイトル</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>開始日</TableHead>
              <TableHead>終了日</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.data && data.data.length > 0 ? (
              data.data.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell>
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="font-mono text-sm text-blue-600 hover:underline"
                    >
                      {contract.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(contract.staff as any)?.full_name || '-'}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="hover:underline"
                    >
                      {contract.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <ContractStatusBadge status={contract.status as ContractStatus} />
                  </TableCell>
                  <TableCell>{formatDate(contract.start_date)}</TableCell>
                  <TableCell>{formatDate(contract.end_date)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  契約が見つかりません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Result count */}
      {data && (
        <p className="text-sm text-muted-foreground">
          {data.total}件中 {data.data.length}件を表示
        </p>
      )}
    </div>
  )
}
