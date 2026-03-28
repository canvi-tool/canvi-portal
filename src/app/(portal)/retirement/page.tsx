'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Search, Eye, Send } from 'lucide-react'

// --- Types ---

type RetirementStatus = 'pending' | 'documents_sent' | 'signed' | 'completed'
type RecordType = 'retirement' | 'separation'

interface RetirementRecord {
  id: string
  staffName: string
  type: RecordType
  employmentType: string
  lastDay: string
  status: RetirementStatus
  documentStatus: string
  finalPayment: string
  registeredAt: string
}

// --- Demo Data ---

const DEMO_DATA: RetirementRecord[] = [
  { id: '1', staffName: '山田太郎', type: 'retirement' as const, employmentType: '社員', lastDay: '2026-03-31', status: 'documents_sent', documentStatus: '署名待ち', finalPayment: '未処理', registeredAt: '2026-03-15' },
  { id: '2', staffName: '佐藤美咲', type: 'separation' as const, employmentType: 'フリーランス', lastDay: '2026-04-15', status: 'completed', documentStatus: '締結済', finalPayment: '発行済', registeredAt: '2026-03-01' },
  { id: '3', staffName: '田中一郎', type: 'separation' as const, employmentType: '業務委託', lastDay: '2026-04-30', status: 'pending', documentStatus: '未送付', finalPayment: '未処理', registeredAt: '2026-03-20' },
  { id: '4', staffName: '鈴木花子', type: 'retirement' as const, employmentType: '契約社員', lastDay: '2026-03-31', status: 'signed', documentStatus: '締結済', finalPayment: '確定済', registeredAt: '2026-03-10' },
]

// --- Constants ---

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'すべて' },
  { value: 'pending', label: '申請中' },
  { value: 'documents_sent', label: '書類送付済' },
  { value: 'signed', label: '締結済' },
  { value: 'completed', label: '完了' },
]

const STATUS_CONFIG: Record<RetirementStatus, { label: string; className: string }> = {
  pending: {
    label: '申請中',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  documents_sent: {
    label: '書類送付済',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  signed: {
    label: '締結済',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },
  completed: {
    label: '完了',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
}

const TYPE_LABELS: Record<RecordType, string> = {
  retirement: '退職',
  separation: '離任',
}

// --- Helpers ---

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function StatusBadge({ status }: { status: RetirementStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  )
}

// --- Page ---

export default function RetirementPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = DEMO_DATA.filter((record) => {
    if (statusFilter && record.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        record.staffName.toLowerCase().includes(q) ||
        record.employmentType.toLowerCase().includes(q) ||
        TYPE_LABELS[record.type].includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="退職・離任管理"
        description="社員の退職手続き、業務委託・フリーランスの離任手続きを管理します"
        actions={
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新規登録
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="スタッフ名、雇用形態で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              <TableHead>スタッフ名</TableHead>
              <TableHead>区分</TableHead>
              <TableHead>雇用形態</TableHead>
              <TableHead>最終稼働日</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>書類ステータス</TableHead>
              <TableHead>最終支払</TableHead>
              <TableHead>登録日</TableHead>
              <TableHead className="text-right">アクション</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? (
              filtered.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.staffName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {TYPE_LABELS[record.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>{record.employmentType}</TableCell>
                  <TableCell>{formatDate(record.lastDay)}</TableCell>
                  <TableCell>
                    <StatusBadge status={record.status} />
                  </TableCell>
                  <TableCell>{record.documentStatus}</TableCell>
                  <TableCell>{record.finalPayment}</TableCell>
                  <TableCell>{formatDate(record.registeredAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        詳細
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Send className="h-4 w-4 mr-1" />
                        書類送付
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  該当するレコードが見つかりません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Result count */}
      <p className="text-sm text-muted-foreground">
        {DEMO_DATA.length}件中 {filtered.length}件を表示
      </p>
    </div>
  )
}
