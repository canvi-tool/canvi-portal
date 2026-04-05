'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileText, CheckCircle, Clock, Filter, Eye } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { useDailyReports, type DailyReport } from '@/hooks/use-daily-reports'
import { useStaffList } from '@/hooks/use-projects'
import {
  DAILY_REPORT_TYPE_LABELS,
  DAILY_REPORT_STATUS_LABELS,
} from '@/lib/validations/daily-report'
import type { DailyReportType } from '@/lib/validations/daily-report'

// --- Helpers ---

function getMonthFirstDay(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function getToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const TYPE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  training: 'outline',
  outbound: 'default',
  inbound: 'secondary',
}

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  submitted: 'secondary',
  approved: 'default',
  rejected: 'destructive',
}

// --- Component ---

export default function WorkReportsPage() {
  const router = useRouter()

  // Filter state
  const [startDate, setStartDate] = useState(getMonthFirstDay)
  const [endDate, setEndDate] = useState(getToday)
  const [reportType, setReportType] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Build query params
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    if (reportType && reportType !== 'all') params.report_type = reportType
    if (statusFilter && statusFilter !== 'all') params.status = statusFilter
    return params
  }, [startDate, endDate, reportType, statusFilter])

  // Data fetching
  const { data: reports = [], isLoading } = useDailyReports(queryParams)
  const { data: staffList = [] } = useStaffList()

  // Stats (current month)
  const stats = useMemo(() => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthReports = reports.filter(
      (r) => r.report_date && r.report_date.startsWith(currentMonth)
    )
    const totalCount = monthReports.length
    const submittedCount = monthReports.filter((r) => r.status === 'submitted').length
    const approvedCount = monthReports.filter((r) => r.status === 'approved').length
    const pendingCount = submittedCount // submitted but not yet approved

    return { totalCount, submittedCount, approvedCount, pendingCount }
  }, [reports])

  // Staff name helper
  const getStaffName = (report: DailyReport): string => {
    if (report.staff_name) return report.staff_name
    if (report.staff) {
      return `${report.staff.last_name || ''} ${report.staff.first_name || ''}`.trim()
    }
    return '-'
  }

  // Table columns
  const columns: DataTableColumn<DailyReport>[] = [
    {
      key: 'report_date',
      header: '日付',
      accessor: (row) => row.report_date,
      cell: (row) => <span className="whitespace-nowrap">{row.report_date || '-'}</span>,
    },
    {
      key: 'staff_name',
      header: 'スタッフ名',
      accessor: (row) => getStaffName(row),
      cell: (row) => <span>{getStaffName(row)}</span>,
    },
    {
      key: 'report_type',
      header: 'タイプ',
      accessor: (row) => row.report_type,
      cell: (row) => (
        <Badge variant={TYPE_BADGE_VARIANT[row.report_type] || 'outline'}>
          {DAILY_REPORT_TYPE_LABELS[row.report_type as DailyReportType] || row.report_type}
        </Badge>
      ),
    },
    {
      key: 'project_name',
      header: 'PJ名',
      accessor: (row) =>
        row.report_type === 'training'
          ? '-'
          : row.project_name || (row.project as { name?: string } | null)?.name || '-',
      cell: (row) => (
        <span>
          {row.report_type === 'training'
            ? '-'
            : row.project_name || (row.project as { name?: string } | null)?.name || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'ステータス',
      accessor: (row) => row.status,
      cell: (row) => (
        <Badge variant={STATUS_BADGE_VARIANT[row.status ?? ''] || 'outline'}>
          {DAILY_REPORT_STATUS_LABELS[row.status ?? ''] || row.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      accessor: () => null,
      sortable: false,
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/reports/work/${row.id}`)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
      className: 'w-[60px]',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="日報管理"
        actions={
          <Button size="sm" onClick={() => router.push('/reports/work/new')}>
            <Plus className="h-4 w-4 mr-1" />
            新規作成
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-[160px] h-8 text-xs"
        />
        <span className="text-sm text-muted-foreground">〜</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-[160px] h-8 text-xs"
        />
        <Select value={reportType} onValueChange={setReportType}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValueWithLabel
              value={reportType}
              placeholder="全タイプ"
              labels={{
                all: '全タイプ',
                training: '研修日報',
                outbound: '架電日報',
                inbound: '受電日報',
              }}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全タイプ</SelectItem>
            <SelectItem value="training">研修日報</SelectItem>
            <SelectItem value="outbound">架電日報</SelectItem>
            <SelectItem value="inbound">受電日報</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValueWithLabel
              value={statusFilter}
              placeholder="全ステータス"
              labels={{
                all: '全ステータス',
                submitted: '提出済',
                approved: '承認済',
                rejected: '差戻し',
              }}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ステータス</SelectItem>
            <SelectItem value="submitted">提出済</SelectItem>
            <SelectItem value="approved">承認済</SelectItem>
            <SelectItem value="rejected">差戻し</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">今月の日報数</p>
              <p className="text-xl font-bold">{stats.totalCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">提出済</p>
              <p className="text-xl font-bold">{stats.submittedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 shrink-0">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">承認済</p>
              <p className="text-xl font-bold">{stats.approvedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10 shrink-0">
              <Clock className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">未承認</p>
              <p className="text-xl font-bold">{stats.pendingCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      {isLoading ? (
        <LoadingSkeleton variant="table" rows={8} />
      ) : (
        <DataTable
          columns={columns}
          data={reports}
          loading={isLoading}
          emptyMessage="日報データがありません"
          keyExtractor={(row) => row.id}
          defaultSortKey="report_date"
          defaultSortDir="desc"
        />
      )}
    </div>
  )
}
