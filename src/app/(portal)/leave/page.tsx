'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS } from '@/lib/constants'
import {
  Plus,
  Palmtree,
  CalendarCheck2,
  TrendingUp,
  Clock,
} from 'lucide-react'

// --- Types ---
type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
type LeaveType = 'full_day' | 'half_day_am' | 'half_day_pm' | 'hourly'

interface LeaveRequest {
  id: string
  staff_name: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  days: number
  reason: string
  status: LeaveStatus
  created_at: string
}

// --- Demo Data ---
const demoLeaveRequests: LeaveRequest[] = [
  {
    id: 'leave-001',
    staff_name: '佐藤 健太',
    leave_type: 'full_day',
    start_date: '2026-04-10',
    end_date: '2026-04-10',
    days: 1,
    reason: '私用のため',
    status: 'approved',
    created_at: '2026-04-01',
  },
  {
    id: 'leave-002',
    staff_name: '佐藤 健太',
    leave_type: 'half_day_am',
    start_date: '2026-04-15',
    end_date: '2026-04-15',
    days: 0.5,
    reason: '通院のため',
    status: 'pending',
    created_at: '2026-04-03',
  },
  {
    id: 'leave-003',
    staff_name: '田中 美咲',
    leave_type: 'full_day',
    start_date: '2026-04-20',
    end_date: '2026-04-22',
    days: 3,
    reason: '家族旅行',
    status: 'approved',
    created_at: '2026-03-25',
  },
  {
    id: 'leave-004',
    staff_name: '鈴木 大輔',
    leave_type: 'half_day_pm',
    start_date: '2026-04-08',
    end_date: '2026-04-08',
    days: 0.5,
    reason: '役所手続き',
    status: 'rejected',
    created_at: '2026-04-02',
  },
  {
    id: 'leave-005',
    staff_name: '佐藤 健太',
    leave_type: 'hourly',
    start_date: '2026-04-25',
    end_date: '2026-04-25',
    days: 0.25,
    reason: '歯科受診',
    status: 'pending',
    created_at: '2026-04-05',
  },
  {
    id: 'leave-006',
    staff_name: '田中 美咲',
    leave_type: 'full_day',
    start_date: '2026-03-10',
    end_date: '2026-03-10',
    days: 1,
    reason: '体調不良',
    status: 'cancelled',
    created_at: '2026-03-08',
  },
]

// --- Status variant mapping ---
const leaveStatusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  cancelled: 'outline',
}

// --- Column definitions (static, outside component to avoid re-creation) ---
const columns: DataTableColumn<LeaveRequest>[] = [
  {
    key: 'staff_name',
    header: 'スタッフ',
    accessor: (row) => row.staff_name,
    cell: (row) => <span className="font-medium">{row.staff_name}</span>,
  },
  {
    key: 'leave_type',
    header: '種別',
    accessor: (row) => row.leave_type,
    cell: (row) => (
      <span className="text-sm">{LEAVE_TYPE_LABELS[row.leave_type] ?? row.leave_type}</span>
    ),
  },
  {
    key: 'start_date',
    header: '期間',
    accessor: (row) => row.start_date,
    cell: (row) => (
      <span className="text-sm">
        {row.start_date.replace(/-/g, '/')}
        {row.start_date !== row.end_date && ` 〜 ${row.end_date.replace(/-/g, '/')}`}
      </span>
    ),
  },
  {
    key: 'days',
    header: '日数',
    accessor: (row) => row.days,
    cell: (row) => (
      <span className="font-mono text-sm">{row.days}日</span>
    ),
  },
  {
    key: 'reason',
    header: '理由',
    accessor: (row) => row.reason,
    cell: (row) => (
      <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
        {row.reason}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'ステータス',
    accessor: (row) => row.status,
    cell: (row) => (
      <StatusBadge
        status={row.status}
        labels={LEAVE_STATUS_LABELS}
        variants={leaveStatusVariants}
      />
    ),
  },
  {
    key: 'created_at',
    header: '申請日',
    accessor: (row) => row.created_at,
    cell: (row) => <span>{row.created_at.replace(/-/g, '/')}</span>,
  },
]

// --- Component ---
export default function LeavePage() {
  const [statusFilter, setStatusFilter] = useState('all')

  // Filtered data
  const filtered = useMemo(() => {
    let data: LeaveRequest[] = demoLeaveRequests
    if (statusFilter !== 'all') {
      data = data.filter((d) => d.status === statusFilter)
    }
    return data
  }, [statusFilter])

  // Summary calculations
  const summary = useMemo(() => {
    const all = demoLeaveRequests
    const totalGranted = 20 // 年間付与日数（デモ用固定値）
    const usedDays = all
      .filter((r) => r.status === 'approved')
      .reduce((sum, r) => sum + r.days, 0)
    const pendingCount = all.filter((r) => r.status === 'pending').length
    const remaining = totalGranted - usedDays
    const usageRate = totalGranted > 0 ? Math.round((usedDays / totalGranted) * 100) : 0

    return {
      totalGranted,
      usedDays,
      remaining,
      usageRate,
      pendingCount,
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="有給管理"
        description="有給休暇の申請・取得状況の管理"
        actions={
          <Link href="/leave/new" className={buttonVariants()} aria-label="有給申請を作成">
            <Plus className="h-4 w-4 mr-1" />
            有給申請
          </Link>
        }
      />

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">有給残日数</CardTitle>
            <Palmtree className="h-4 w-4 text-green-600" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.remaining}日</div>
            <p className="text-xs text-muted-foreground mt-1">
              年間付与 {summary.totalGranted}日
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今年度取得日数</CardTitle>
            <CalendarCheck2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.usedDays}日</div>
            <p className="text-xs text-muted-foreground mt-1">
              承認済み取得分
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">取得率</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.usageRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              年間付与に対する取得率
            </p>
          </CardContent>
        </Card>
        <Card className={summary.pendingCount > 0 ? 'border-amber-500/50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">申請中</CardTitle>
            <Clock className={`h-4 w-4 ${summary.pendingCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.pendingCount > 0 ? 'text-amber-600' : ''}`}>
              {summary.pendingCount}件
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              承認待ち
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? 'all')}>
          <SelectTrigger className="w-40" aria-label="ステータスで絞り込み">
            <SelectValueWithLabel
              value={statusFilter}
              labels={{ all: 'すべて', ...LEAVE_STATUS_LABELS }}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {Object.entries(LEAVE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage="条件に一致する有給申請が見つかりません"
        keyExtractor={(row) => row.id}
      />
    </div>
  )
}
