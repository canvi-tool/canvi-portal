'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { useAttendanceRecords } from '@/hooks/use-attendance'
import { useProjects } from '@/hooks/use-projects'
import { useStaffList } from '@/hooks/use-staff'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Calendar, Clock, ArrowLeft, Filter } from 'lucide-react'
import { ATTENDANCE_STATUS_LABELS } from '@/lib/validations/attendance'
import { CorrectionRequestsSection } from './_components/correction-requests-section'

function formatTime(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })
}

function formatMinutes(minutes: number | null | undefined) {
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
    case 'approved': return 'default'
    default: return 'outline'
  }
}

export default function AttendanceManagePage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    jst.setUTCDate(1)
    return jst.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date()
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    return jst.toISOString().split('T')[0]
  })
  const [projectId, setProjectId] = useState<string>('')
  const [staffId, setStaffId] = useState<string>('')

  // 権限チェック
  useEffect(() => {
    fetch('/api/auth/shift-permissions')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setAuthorized(d?.role === 'owner' || d?.role === 'admin')
      })
      .catch(() => setAuthorized(false))
  }, [])

  const { data: projectsData } = useProjects()
  const { data: staffData } = useStaffList({ limit: 500 })
  const { data: recordsData, isLoading } = useAttendanceRecords({
    scope: 'manage',
    date_from: dateFrom,
    date_to: dateTo,
    project_id: projectId || undefined,
    staff_id: staffId || undefined,
    per_page: 200,
  })

  const projects = useMemo(() => projectsData || [], [projectsData])
  const staffList = useMemo(() => staffData?.data || [], [staffData])
  const records = useMemo(() => recordsData?.data || [], [recordsData])

  // 集計
  const summary = useMemo(() => {
    const totalWork = records.reduce((sum, r) => sum + (r.work_minutes || 0), 0)
    const totalOvertime = records.reduce((sum, r) => sum + (r.overtime_minutes || 0), 0)
    const staffSet = new Set(records.map((r) => r.staff_id).filter(Boolean))
    return { totalWork, totalOvertime, staffCount: staffSet.size, recordCount: records.length }
  }, [records])

  if (authorized === null) {
    return <div className="py-12 text-center text-muted-foreground">権限を確認中...</div>
  }
  if (authorized === false) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">このページを閲覧する権限がありません</p>
        <Link href="/attendance" className="text-primary hover:underline text-sm mt-2 inline-block">
          勤怠ページに戻る
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <PageHeader
          title="勤怠管理（メンバー）"
          description="管轄プロジェクトのメンバーの打刻を管理します"
        />
        <Link
          href="/attendance"
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          自分の勤怠へ
        </Link>
      </div>

      {/* サマリー */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">対象メンバー</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.staffCount}<span className="text-sm font-normal text-muted-foreground ml-1">名</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">打刻件数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.recordCount}<span className="text-sm font-normal text-muted-foreground ml-1">件</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">総勤務時間</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMinutes(summary.totalWork)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">残業時間</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${summary.totalOvertime > 0 ? 'text-orange-500' : ''}`}>
              {formatMinutes(summary.totalOvertime)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 修正申請 承認待ち */}
      <CorrectionRequestsSection />

      {/* フィルター */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            フィルター
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px]"
              />
              <span className="text-muted-foreground">〜</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[200px]"
            >
              <option value="">全プロジェクト</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_code ? `${p.project_code} ` : ''}{p.name}
                </option>
              ))}
            </select>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[200px]"
            >
              <option value="">全メンバー</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.last_name} {s.first_name}
                </option>
              ))}
            </select>
            {(projectId || staffId) && (
              <button
                type="button"
                onClick={() => { setProjectId(''); setStaffId('') }}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                クリア
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 打刻一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            メンバー打刻記録
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              条件に一致する打刻記録はありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日付</TableHead>
                    <TableHead>メンバー</TableHead>
                    <TableHead>プロジェクト</TableHead>
                    <TableHead>出勤</TableHead>
                    <TableHead>退勤</TableHead>
                    <TableHead>休憩</TableHead>
                    <TableHead>勤務時間</TableHead>
                    <TableHead>残業</TableHead>
                    <TableHead>ステータス</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const rec = r as any
                    const staffName = rec.staff
                      ? `${rec.staff.last_name || ''} ${rec.staff.first_name || ''}`.trim()
                      : rec.user?.display_name || '-'
                    const projectLabel = rec.project
                      ? rec.project.name || rec.project.project_code
                      : '-'
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{r.date}</TableCell>
                        <TableCell className="font-medium">{staffName}</TableCell>
                        <TableCell>{projectLabel}</TableCell>
                        <TableCell>{formatTime(r.clock_in)}</TableCell>
                        <TableCell>{formatTime(r.clock_out)}</TableCell>
                        <TableCell>{r.break_minutes ? `${r.break_minutes}分` : '-'}</TableCell>
                        <TableCell>{formatMinutes(r.work_minutes)}</TableCell>
                        <TableCell>{formatMinutes(r.overtime_minutes)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(r.status)}>
                            {ATTENDANCE_STATUS_LABELS[r.status] || r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
