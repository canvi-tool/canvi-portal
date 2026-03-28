'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Search, FileText, Send, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { useContractList } from '@/hooks/use-contracts'
import { ContractStatusBadge } from './_components/contract-status-tracker'
import { toast } from 'sonner'
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

interface BulkSendResult {
  contractId: string
  staffName: string
  email: string
  status: 'success' | 'error' | 'skipped'
  message: string
}

export default function ContractsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkResults, setBulkResults] = useState<BulkSendResult[] | null>(null)
  const [showResultDialog, setShowResultDialog] = useState(false)

  const { data, isLoading, refetch } = useContractList({
    search: debouncedSearch,
    status: statusFilter,
  })

  const handleSearchChange = useMemo(() => {
    let timeout: NodeJS.Timeout
    return (value: string) => {
      setSearch(value)
      clearTimeout(timeout)
      timeout = setTimeout(() => setDebouncedSearch(value), 300)
    }
  }, [])

  const draftContracts = data?.data?.filter((c) => c.status === 'draft') || []
  const allDraftsSelected = draftContracts.length > 0 && draftContracts.every((c) => selectedIds.has(c.id))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allDraftsSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(draftContracts.map((c) => c.id)))
    }
  }

  const handleBulkSend = async () => {
    if (selectedIds.size === 0) {
      toast.error('送信する契約を選択してください')
      return
    }

    setBulkSending(true)
    try {
      const res = await fetch('/api/contracts/bulk-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractIds: Array.from(selectedIds) }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '一括送信に失敗しました')
      }

      const result = await res.json()
      setBulkResults(result.results)
      setShowResultDialog(true)

      const { summary } = result
      if (summary.success > 0) {
        toast.success(`${summary.success}件の署名依頼を送信しました`)
      }
      if (summary.error > 0) {
        toast.error(`${summary.error}件の送信に失敗しました`)
      }

      setSelectedIds(new Set())
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '一括送信に失敗しました')
    } finally {
      setBulkSending(false)
    }
  }

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
            <Button variant="outline" render={<Link href="/contracts/send" />}>
              <Send className="h-4 w-4 mr-2" />
              一括送付
            </Button>
            <Button render={<Link href="/contracts/new" />}>
              <Plus className="h-4 w-4 mr-2" />
              新規作成
            </Button>
          </div>
        }
      />

      {/* Bulk Send Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30">
          <CardContent className="flex items-center justify-between py-3">
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
              {selectedIds.size}件の契約を選択中
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                選択解除
              </Button>
              <Button
                size="sm"
                onClick={handleBulkSend}
                disabled={bulkSending}
              >
                {bulkSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    送信中...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    一括署名依頼
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allDraftsSelected && draftContracts.length > 0}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300"
                  title="下書きをすべて選択"
                />
              </TableHead>
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
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.data && data.data.length > 0 ? (
              data.data.map((contract) => {
                const isDraft = contract.status === 'draft'
                return (
                  <TableRow key={contract.id} className={selectedIds.has(contract.id) ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(contract.id)}
                        onChange={() => toggleSelect(contract.id)}
                        disabled={!isDraft}
                        className="h-4 w-4 rounded border-gray-300 disabled:opacity-30"
                      />
                    </TableCell>
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
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
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

      {/* Bulk Send Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>一括送信結果</DialogTitle>
            <DialogDescription>
              署名依頼の送信結果を確認してください。
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 max-h-80 overflow-y-auto">
            {bulkResults?.map((result) => (
              <div
                key={result.contractId}
                className="flex items-start gap-3 border-b py-3 last:border-0"
              >
                <div className="mt-0.5 shrink-0">
                  {result.status === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : result.status === 'error' ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{result.staffName}</p>
                  <p className="text-xs text-muted-foreground">{result.email || 'メール未設定'}</p>
                  <p className="text-xs mt-0.5">{result.message}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowResultDialog(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
