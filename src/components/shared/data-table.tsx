'use client'

import { useState, useMemo, useCallback, type ReactNode } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react'

export interface DataTableColumn<T> {
  key: string
  header: string
  accessor: (row: T) => unknown
  cell?: (row: T) => ReactNode
  sortable?: boolean
  className?: string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  pageSize?: number
  keyExtractor?: (row: T) => string
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
}

type SortDirection = 'asc' | 'desc' | null

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'データがありません',
  pageSize = 10,
  keyExtractor,
  selectable = false,
  selectedIds,
  onSelectionChange,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [page, setPage] = useState(0)

  const getRowId = useCallback(
    (row: T, idx: number) => keyExtractor?.(row) ?? String(idx),
    [keyExtractor]
  )

  const allPageIds = useMemo(() => {
    if (!selectable || !keyExtractor) return []
    const start = page * pageSize
    const end = start + pageSize
    const sorted = sortKey && sortDir ? [...data] : data
    return sorted.slice(start, end).map((row) => keyExtractor(row))
  }, [selectable, keyExtractor, data, page, pageSize, sortKey, sortDir])

  const isAllPageSelected = useMemo(() => {
    if (!selectedIds || allPageIds.length === 0) return false
    return allPageIds.every((id) => selectedIds.has(id))
  }, [selectedIds, allPageIds])

  const isSomePageSelected = useMemo(() => {
    if (!selectedIds || allPageIds.length === 0) return false
    return allPageIds.some((id) => selectedIds.has(id)) && !isAllPageSelected
  }, [selectedIds, allPageIds, isAllPageSelected])

  const toggleSelectAll = useCallback(() => {
    if (!onSelectionChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (isAllPageSelected) {
      allPageIds.forEach((id) => next.delete(id))
    } else {
      allPageIds.forEach((id) => next.add(id))
    }
    onSelectionChange(next)
  }, [onSelectionChange, selectedIds, isAllPageSelected, allPageIds])

  const toggleSelectRow = useCallback(
    (id: string) => {
      if (!onSelectionChange || !selectedIds) return
      const next = new Set(selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      onSelectionChange(next)
    },
    [onSelectionChange, selectedIds]
  )

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else if (sortDir === 'desc') {
        setSortKey(null)
        setSortDir(null)
      }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(0)
  }

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data

    const col = columns.find((c) => c.key === sortKey)
    if (!col) return data

    return [...data].sort((a, b) => {
      const aVal = col.accessor(a)
      const bVal = col.accessor(b)

      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1

      const comparison =
        typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal), 'ja')

      return sortDir === 'asc' ? comparison : -comparison
    })
  }, [data, sortKey, sortDir, columns])

  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = sortedData.slice(
    page * pageSize,
    (page + 1) * pageSize
  )

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={isAllPageSelected}
                    indeterminate={isSomePageSelected}
                    onChange={toggleSelectAll}
                    aria-label="全て選択"
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.sortable !== false ? (
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.header}
                      {sortKey === col.key && sortDir === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : sortKey === col.key && sortDir === 'desc' ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, idx) => {
                const rowId = getRowId(row, page * pageSize + idx)
                const isSelected = selectable && selectedIds?.has(rowId)
                return (
                  <TableRow
                    key={keyExtractor ? keyExtractor(row) : idx}
                    className={isSelected ? 'bg-primary/5' : undefined}
                  >
                    {selectable && (
                      <TableCell className="w-[40px]">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleSelectRow(rowId)}
                          aria-label="行を選択"
                        />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.className}>
                        {col.cell ? col.cell(row) : String(col.accessor(row) ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            全{sortedData.length.toLocaleString('ja-JP')}件
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              前へ
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              次へ
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
