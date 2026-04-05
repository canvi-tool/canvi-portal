'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { BulkActionBar } from '@/components/shared/bulk-action-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { PROJECT_STATUS_LABELS } from '@/lib/constants'
import { useProjects, useBulkUpdateProjectStatus, type Project } from '@/hooks/use-projects'
import { toast } from 'sonner'
import { Plus, Search, Briefcase, Users } from 'lucide-react'

const BULK_STATUS_OPTIONS = [
  { value: 'proposing', label: '提案中に変更' },
  { value: 'active', label: '契約中に変更' },
  { value: 'ended', label: '契約終了に変更' },
]

const PROJECT_TYPE_TABS = [
  { value: 'all', label: 'すべて' },
  { value: 'BPO', label: 'BPO' },
  { value: 'RPO', label: 'RPO' },
  { value: 'ETC', label: 'ETC' },
] as const

export default function ProjectsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeTab, setTypeTab] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const bulkUpdate = useBulkUpdateProjectStatus()

  const { data: projects, isLoading } = useProjects({
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })

  // タブでフィルタリング（project_type: BPO/RPO/ETC）
  const filteredProjects = useMemo(() => {
    if (!projects) return []
    if (typeTab === 'all') return projects
    return projects.filter((p) => p.project_type === typeTab)
  }, [projects, typeTab])

  // 各タブのカウント
  const tabCounts = useMemo(() => {
    if (!projects) return { all: 0, BPO: 0, RPO: 0, ETC: 0 }
    const counts = { all: projects.length, BPO: 0, RPO: 0, ETC: 0 }
    for (const p of projects) {
      const t = p.project_type as keyof typeof counts
      if (t in counts) counts[t]++
    }
    return counts
  }, [projects])

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
      key: 'slack',
      header: 'Slack',
      accessor: (row) => row.slack_channel_id ?? '',
      cell: (row) => (
        <Link
          href={`/projects/${row.id}`}
          title={row.slack_channel_name ? `#${row.slack_channel_name}` : '未連携 — クリックして設定'}
          className={`flex cursor-pointer hover:opacity-70 transition-opacity ${row.slack_channel_id ? 'text-emerald-600' : 'text-muted-foreground/30'}`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
          </svg>
        </Link>
      ),
    },
    {
      key: 'assignment_count',
      header: 'メンバー数',
      accessor: (row) => row.assignment_count ?? 0,
      cell: (row) => {
        const names = row.assignment_names ?? []
        const tooltip = names.length > 0
          ? names.join('、')
          : 'メンバー未アサイン'
        return (
          <Link
            href={`/projects/${row.id}?tab=members`}
            title={tooltip}
            className="flex items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity"
          >
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{row.assignment_count ?? 0}</span>
          </Link>
        )
      },
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

      {/* BPO / RPO / ETC タブ */}
      <Tabs value={typeTab} onValueChange={(val) => { setTypeTab(val); setSelectedIds(new Set()) }}>
        <TabsList>
          {PROJECT_TYPE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                {tabCounts[tab.value as keyof typeof tabCounts]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
      {!isLoading && filteredProjects.length === 0 && !search && statusFilter === 'all' && typeTab === 'all' ? (
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
          data={filteredProjects}
          loading={isLoading}
          emptyMessage={
            typeTab !== 'all'
              ? `${typeTab}のプロジェクトがありません`
              : '条件に一致するプロジェクトが見つかりません'
          }
          keyExtractor={(row) => row.id}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={filteredProjects.length}
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
