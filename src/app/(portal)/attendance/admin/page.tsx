'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Users,
  LogIn,
  Coffee,
  LogOut,
  UserX,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowLeft,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ATTENDANCE_STATUS_LABELS } from '@/lib/validations/attendance'

// --- Types ---

interface StaffTodayStatus {
  staff_id: string
  user_id: string | null
  display_name: string
  email: string
  status: string
  clock_in: string | null
  clock_out: string | null
  work_minutes: number | null
  break_minutes: number
  project: { id: string; name: string; project_code: string } | null
  attendance_id: string | null
}

interface AttendanceSummaryResponse {
  today: StaffTodayStatus[]
  summary: {
    total_staff: number
    clocked_in: number
    on_break: number
    clocked_out: number
    not_clocked_in: number
  }
}

interface PendingModificationRecord {
  id: string
  user_id: string
  staff_id: string | null
  date: string
  clock_in: string | null
  clock_out: string | null
  break_minutes: number
  work_minutes: number | null
  status: string
  modification_reason: string | null
  modified_by: string | null
  note: string | null
  project: { id: string; name: string; project_code: string } | null
  staff: { id: string; display_name: string } | null
}

// --- Helpers ---

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })
}

function formatMinutes(minutes: number | null): string {
  if (minutes == null) return '-'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'clocked_in': return 'default'
    case 'on_break': return 'secondary'
    case 'clocked_out': return 'outline'
    case 'modified': return 'destructive'
    case 'approved': return 'default'
    default: return 'outline'
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    clocked_in: '出勤中',
    on_break: '休憩中',
    clocked_out: '退勤済',
    not_clocked_in: '未出勤',
    modified: '修正済',
    approved: '承認済',
  }
  return labels[status] || status
}

// --- Fetchers ---

async function fetchAttendanceSummary(): Promise<AttendanceSummaryResponse> {
  const res = await fetch('/api/attendance/summary')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '勤怠サマリーの取得に失敗しました')
  }
  return res.json()
}

async function fetchPendingModifications(): Promise<{ data: PendingModificationRecord[] }> {
  const res = await fetch('/api/attendance?status=modified&per_page=100')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '修正申請の取得に失敗しました')
  }
  return res.json()
}

async function approveAttendance(id: string): Promise<unknown> {
  const res = await fetch(`/api/attendance/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approve' }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '承認に失敗しました')
  }
  return res.json()
}

async function rejectAttendance(id: string, reason: string): Promise<unknown> {
  const res = await fetch(`/api/attendance/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'modify',
      modification_reason: reason,
      status: 'clocked_out',
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '却下に失敗しました')
  }
  return res.json()
}

// --- Columns (defined outside component) ---

const todayColumns: DataTableColumn<StaffTodayStatus>[] = [
  {
    key: 'display_name',
    header: 'スタッフ名',
    accessor: (row) => row.display_name,
    cell: (row) => (
      <span className="font-medium">{row.display_name}</span>
    ),
  },
  {
    key: 'status',
    header: 'ステータス',
    accessor: (row) => row.status,
    cell: (row) => (
      <Badge variant={getStatusBadgeVariant(row.status)}>
        {getStatusLabel(row.status)}
      </Badge>
    ),
  },
  {
    key: 'project',
    header: 'プロジェクト',
    accessor: (row) => row.project?.name ?? '',
    cell: (row) =>
      row.project ? (
        <Badge variant="outline" className="text-xs">
          {row.project.project_code}
        </Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    key: 'clock_in',
    header: '出勤時刻',
    accessor: (row) => row.clock_in ?? '',
    cell: (row) => (
      <span className="font-mono text-sm">{formatTime(row.clock_in)}</span>
    ),
  },
  {
    key: 'clock_out',
    header: '退勤時刻',
    accessor: (row) => row.clock_out ?? '',
    cell: (row) => (
      <span className="font-mono text-sm">{formatTime(row.clock_out)}</span>
    ),
  },
  {
    key: 'work_minutes',
    header: '勤務時間',
    accessor: (row) => row.work_minutes ?? 0,
    cell: (row) => (
      <span className="font-mono text-sm">{formatMinutes(row.work_minutes)}</span>
    ),
  },
  {
    key: 'break_minutes',
    header: '休憩',
    accessor: (row) => row.break_minutes,
    cell: (row) => (
      <span className="text-sm">
        {row.break_minutes > 0 ? `${row.break_minutes}分` : '-'}
      </span>
    ),
  },
]

const pendingColumns: DataTableColumn<PendingModificationRecord>[] = [
  {
    key: 'staff_name',
    header: 'スタッフ名',
    accessor: (row) => row.staff?.display_name ?? '',
    cell: (row) => (
      <span className="font-medium">{row.staff?.display_name ?? '-'}</span>
    ),
  },
  {
    key: 'date',
    header: '日付',
    accessor: (row) => row.date,
    cell: (row) => {
      const d = new Date(row.date + 'T00:00:00')
      const weekdays = ['日', '月', '火', '水', '木', '金', '土']
      return (
        <span className="text-sm">
          {d.getMonth() + 1}/{d.getDate()}({weekdays[d.getDay()]})
        </span>
      )
    },
  },
  {
    key: 'project',
    header: 'プロジェクト',
    accessor: (row) => row.project?.name ?? '',
    cell: (row) =>
      row.project ? (
        <Badge variant="outline" className="text-xs">
          {row.project.project_code}
        </Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    key: 'clock_in',
    header: '出勤',
    accessor: (row) => row.clock_in ?? '',
    cell: (row) => (
      <span className="font-mono text-sm">{formatTime(row.clock_in)}</span>
    ),
  },
  {
    key: 'clock_out',
    header: '退勤',
    accessor: (row) => row.clock_out ?? '',
    cell: (row) => (
      <span className="font-mono text-sm">{formatTime(row.clock_out)}</span>
    ),
  },
  {
    key: 'modification_reason',
    header: '修正理由',
    accessor: (row) => row.modification_reason ?? '',
    cell: (row) => (
      <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
        {row.modification_reason || '-'}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'ステータス',
    accessor: (row) => row.status,
    cell: (row) => (
      <Badge variant={getStatusBadgeVariant(row.status)}>
        {ATTENDANCE_STATUS_LABELS[row.status] || row.status}
      </Badge>
    ),
    sortable: false,
  },
  {
    key: 'actions',
    header: 'アクション',
    accessor: () => '',
    sortable: false,
    cell: () => null, // Rendered via custom row handling below
  },
]

// --- Component ---

export default function AttendanceAdminPage() {
  const queryClient = useQueryClient()

  // Fetch today's summary
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
  } = useQuery({
    queryKey: ['attendance', 'summary'],
    queryFn: fetchAttendanceSummary,
    refetchInterval: 60000,
  })

  // Fetch pending modification records
  const {
    data: pendingData,
    isLoading: isPendingLoading,
  } = useQuery({
    queryKey: ['attendance', 'pending-modifications'],
    queryFn: fetchPendingModifications,
  })

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: approveAttendance,
    onSuccess: () => {
      toast.success('打刻を承認しました')
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      setDialogOpen(false)
      setSelectedRecord(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || '承認に失敗しました')
    },
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectAttendance(id, reason),
    onSuccess: () => {
      toast.success('修正申請を却下しました')
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      setDialogOpen(false)
      setSelectedRecord(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || '却下に失敗しました')
    },
  })

  // UI state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<PendingModificationRecord | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const isMutating = approveMutation.isPending || rejectMutation.isPending

  const todayStatuses = useMemo(() => summaryData?.today || [], [summaryData])
  const summary = useMemo(
    () =>
      summaryData?.summary || {
        total_staff: 0,
        clocked_in: 0,
        on_break: 0,
        clocked_out: 0,
        not_clocked_in: 0,
      },
    [summaryData]
  )
  const pendingRecords = useMemo(
    () => pendingData?.data?.filter((r) => r.status === 'modified') || [],
    [pendingData]
  )

  const openDetail = useCallback((record: PendingModificationRecord) => {
    setSelectedRecord(record)
    setRejectReason('')
    setDialogOpen(true)
  }, [])

  const handleApprove = useCallback(
    (id: string) => {
      approveMutation.mutate(id)
    },
    [approveMutation]
  )

  const handleReject = useCallback(
    (id: string) => {
      if (!rejectReason.trim()) {
        toast.error('却下理由を入力してください')
        return
      }
      rejectMutation.mutate({ id, reason: rejectReason })
    },
    [rejectMutation, rejectReason]
  )

  // Override the actions column with actual buttons
  const pendingColumnsWithActions: DataTableColumn<PendingModificationRecord>[] = useMemo(
    () =>
      pendingColumns.map((col) =>
        col.key === 'actions'
          ? {
              ...col,
              cell: (row: PendingModificationRecord) => (
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs bg-green-600 hover:bg-green-700"
                    disabled={isMutating}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleApprove(row.id)
                    }}
                    aria-label={`${row.staff?.display_name ?? ''}の修正を承認`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    承認
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    disabled={isMutating}
                    onClick={(e) => {
                      e.stopPropagation()
                      openDetail(row)
                    }}
                    aria-label={`${row.staff?.display_name ?? ''}の修正を却下`}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    却下
                  </Button>
                </div>
              ),
            }
          : col
      ),
    [isMutating, handleApprove, openDetail]
  )

  // Loading state
  if (isSummaryLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="勤怠管理（管理者）"
          description="スタッフの出勤状況と修正申請の承認管理を行います"
          actions={
            <Link
              href="/attendance"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
              aria-label="勤怠打刻ページに戻る"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              打刻ページへ
            </Link>
          }
        />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">読み込み中...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (isSummaryError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="勤怠管理（管理者）"
          description="スタッフの出勤状況と修正申請の承認管理を行います"
          actions={
            <Link
              href="/attendance"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
              aria-label="勤怠打刻ページに戻る"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              打刻ページへ
            </Link>
          }
        />
        <div className="py-12 text-center text-destructive">
          データの取得に失敗しました。ページを再読み込みしてください。
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="勤怠管理（管理者）"
        description="スタッフの出勤状況と修正申請の承認管理を行います"
        actions={
          <Link
            href="/attendance"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            aria-label="勤怠打刻ページに戻る"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            打刻ページへ
          </Link>
        }
      />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal flex items-center gap-1.5">
              <LogIn className="h-4 w-4" />
              出勤中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {summary.clocked_in}
              <span className="text-sm font-normal text-muted-foreground ml-1">名</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal flex items-center gap-1.5">
              <UserX className="h-4 w-4" />
              未出勤
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {summary.not_clocked_in}
              <span className="text-sm font-normal text-muted-foreground ml-1">名</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal flex items-center gap-1.5">
              <Coffee className="h-4 w-4" />
              休憩中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {summary.on_break}
              <span className="text-sm font-normal text-muted-foreground ml-1">名</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal flex items-center gap-1.5">
              <LogOut className="h-4 w-4" />
              退勤済み
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-500">
              {summary.clocked_out}
              <span className="text-sm font-normal text-muted-foreground ml-1">名</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Modification Requests */}
      {pendingRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-orange-500" />
              修正申請（承認待ち）
              <Badge variant="destructive" className="ml-1">
                {pendingRecords.length}件
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={pendingColumnsWithActions}
              data={pendingRecords}
              loading={isPendingLoading}
              emptyMessage="承認待ちの修正申請はありません"
              keyExtractor={(row) => row.id}
            />
          </CardContent>
        </Card>
      )}

      {/* Today's Staff Attendance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            本日の出勤状況
            <Badge variant="outline" className="ml-1">
              {summary.total_staff}名
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={todayColumns}
            data={todayStatuses}
            loading={isSummaryLoading}
            emptyMessage="スタッフデータがありません"
            keyExtractor={(row) => row.staff_id}
            defaultSortKey="status"
          />
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>修正申請の却下</DialogTitle>
            <DialogDescription>
              却下理由を入力してください
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4">
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">スタッフ</span>
                  <span className="font-medium">{selectedRecord.staff?.display_name ?? '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">日付</span>
                  <span>{selectedRecord.date}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">時間</span>
                  <span className="font-mono">
                    {formatTime(selectedRecord.clock_in)} - {formatTime(selectedRecord.clock_out)}
                  </span>
                </div>
                {selectedRecord.modification_reason && (
                  <div className="border-t pt-2 mt-2">
                    <span className="text-muted-foreground">修正理由: </span>
                    <span>{selectedRecord.modification_reason}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="reject-reason" className="text-sm font-medium">
                  却下理由
                </label>
                <Textarea
                  id="reject-reason"
                  placeholder="却下理由を入力してください"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  aria-label="却下理由"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              disabled={isMutating}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isMutating || !rejectReason.trim()}
              onClick={() => selectedRecord && handleReject(selectedRecord.id)}
              aria-label="却下を確定"
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              却下する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
