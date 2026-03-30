'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { BulkActionBar } from '@/components/shared/bulk-action-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { PROJECT_STATUS_LABELS } from '@/lib/constants'
import { useProjects, useBulkUpdateProjectStatus, type Project } from '@/hooks/use-projects'
import { toast } from 'sonner'
import { Plus, Search, Briefcase, Users } from 'lucide-react'

const BULK_STATUS_OPTIONS = [
  { value: 'active', label: '稼働中に変更' },
  { value: 'paused', label: '一時停止に変更' },
  { value: 'completed', label: '完了に変更' },
  { value: 'archived', label: 'アーカイブに変更' },
]

export default function ProjectsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const bulkUpdate = useBulkUpdateProjectStatus()

  const { data: projects, isLoading } = useProjects({
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })

  const handleBulkStatusChange = async (status: string) => {
    const ids = Array.from(selectedIds)
    try {
      const result = await bulkUpdate.mutateAsync({ ids, status })
      toast.success(`${result.updated}件のプロジェクトのステータスを更新しました`)
      setSelectedIds(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '一括更新に失敗しました')
    }
  }

  const columns: DataTableColumn<Project>[] = [
    {
      key: 'project_code',
      header: 'PJコード',
      accessor: (row) => row.project_code ?? '',
      cell: (row) => {
        return (
          <Link
            href={`/projects/${row.id}`}
            className="font-mono text-sm text-primary hover:underline"
          >
            {row.project_code || '-'}
          </Link>
        )
      },
    },
    {
      key: 'name',
      header: 'PJ名',
      accessor: (row) => row.name,
      cell: (row) => (
        <Link href={`/projects/${row.id}`} className="font-medium hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'ステータス',
      accessor: (row) => row.status,
      cell: (row) => (
        <StatusBadge status={row.status} labels={PROJECT_STATUS_LABELS} />
      ),
    },
    {
      key: 'client_name',
      header: 'クライアント',
      accessor: (row) => row.client_name ?? '',
      cell: (row) =>
        row.client_name || <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'start_date',
      header: '開始日',
      accessor: (row) => row.start_date ?? '',
      cell: (row) =>
        row.start_date || <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'end_date',
      header: '終了日',
      accessor: (row) => row.end_date ?? '',
      cell: (row) =>
        row.end_date || <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'assignment_count',
      header: 'メンバー数',
      accessor: (row) => row.assignment_count ?? 0,
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{row.assignment_count ?? 0}</span>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="プロジェクト管理"
        description="プロジェクトの一覧と管理"
        actions={
          <Button onClick={() => router.push('/projects/new')}>
            <Plus className="h-4 w-4 mr-1" />
            新規作成
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="PJコード、PJ名、クライアント名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? 'all')}>
          <SelectTrigger className="w-40">
            <SelectValueWithLabel value={statusFilter} labels={{ all: 'すべて', ...PROJECT_STATUS_LABELS }} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data */}
      {!isLoading && projects?.length === 0 && !search && statusFilter === 'all' ? (
        <EmptyState
          icon={Briefcase}
          title="プロジェクトがありません"
          description="新しいプロジェクトを作成して、スタッフのアサインと報酬ルールを設定しましょう。"
          action={
            <Button onClick={() => router.push('/projects/new')}>
              <Plus className="h-4 w-4 mr-1" />
              新規作成
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={projects || []}
          loading={isLoading}
          emptyMessage="条件に一致するプロジェクトが見つかりません"
          keyExtractor={(row) => row.id}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={projects?.length ?? 0}
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
