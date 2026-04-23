'use client'

import { useState, useMemo, useEffect } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import {
  useAttendanceRecords,
  useTodayAttendance,
  useMyProjects,
  useClockIn,
  useClockOut,
  useBreakStart,
  useBreakEnd,
} from '@/hooks/use-attendance'
import type { AttendanceRecord, MyProject } from '@/hooks/use-attendance'
import { toast } from 'sonner'
import { ATTENDANCE_STATUS_LABELS, LOCATION_TYPE_LABELS } from '@/lib/validations/attendance'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import Link from 'next/link'
import {
  LogIn,
  LogOut,
  Coffee,
  Play,
  Timer,
  Clock,
  Calendar,
  FolderOpen,
  ArrowLeft,
  RotateCw,
  Users,
  Pencil,
  Trash2,
} from 'lucide-react'
import { CorrectionRequestDialog } from './_components/correction-request-dialog'
import { AttendanceEditDialog } from './_components/attendance-edit-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { attendanceKeys } from '@/hooks/use-attendance'

function formatTime(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })
}

function formatMinutes(minutes: number | null) {
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

function getStatusColor(status: string) {
  switch (status) {
    case 'clocked_in': return 'bg-green-500'
    case 'on_break': return 'bg-yellow-500'
    case 'clocked_out': return 'bg-gray-400'
    default: return 'bg-gray-300'
  }
}

/** プロジェクトごとの今日の打刻状態を計算 */
function getProjectTodayStatus(records: AttendanceRecord[], projectId: string) {
  const projectRecords = records.filter((r) => r.project_id === projectId)
  const activeRecord = projectRecords.find(
    (r) => r.status === 'clocked_in' || r.status === 'on_break'
  )
  return {
    records: projectRecords,
    activeRecord,
    isActive: !!activeRecord,
    totalRecords: projectRecords.length,
  }
}

/** 経過時間を計算して表示用文字列を返す */
function calcElapsed(clockIn: string, breakMinutes: number) {
  const start = new Date(clockIn).getTime()
  const now = Date.now()
  const mins = Math.max(0, Math.floor((now - start) / 60000) - (breakMinutes || 0))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

// ======= プロジェクト選択画面 =======
function ProjectSelector({
  projects,
  todayRecords,
  onSelectProject,
}: {
  projects: MyProject[]
  todayRecords: AttendanceRecord[]
  onSelectProject: (project: MyProject) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        打刻するプロジェクトを選択してください
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const status = getProjectTodayStatus(todayRecords, project.id)
          return (
            <Card
              key={project.id}
              className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
              onClick={() => onSelectProject(project)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-mono">
                      {project.project_code}
                    </p>
                    <p className="font-medium truncate">{project.name}</p>
                  </div>
                  {status.isActive && status.activeRecord && (
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      <span className={`h-2 w-2 rounded-full animate-pulse ${getStatusColor(status.activeRecord.status)}`} />
                      <span className="text-xs font-medium">
                        {status.activeRecord.status === 'clocked_in' ? '勤務中' : '休憩中'}
                      </span>
                    </div>
                  )}
                </div>
                {status.totalRecords > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {status.records.map((r, i) => (
                      <Badge
                        key={r.id}
                        variant={getStatusBadgeVariant(r.status)}
                        className="text-xs"
                      >
                        {i + 1}回目: {formatTime(r.clock_in)}
                        {r.clock_out ? ` 〜 ${formatTime(r.clock_out)}` : ''}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ======= プロジェクト打刻画面 =======
function ProjectAttendance({
  project,
  todayRecords,
  onBack,
}: {
  project: MyProject
  todayRecords: AttendanceRecord[]
  onBack: () => void
}) {
  const clockIn = useClockIn()
  const clockOut = useClockOut()
  const breakStart = useBreakStart()
  const breakEnd = useBreakEnd()

  const status = getProjectTodayStatus(todayRecords, project.id)
  const activeRecord = status.activeRecord

  // リアルタイム経過時間
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    if (!activeRecord?.clock_in || activeRecord.status === 'clocked_out') {
      setElapsed('')
      return
    }
    const update = () => {
      setElapsed(calcElapsed(activeRecord.clock_in!, activeRecord.break_minutes || 0))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [activeRecord?.clock_in, activeRecord?.status, activeRecord?.break_minutes])

  const handleClockIn = async () => {
    try {
      await clockIn.mutateAsync({
        project_id: project.id,
        location_type: 'remote',
      })
      toast.success(`${project.name} に出勤しました`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const handleClockOut = async () => {
    if (!activeRecord?.id) return
    try {
      await clockOut.mutateAsync(activeRecord.id)
      toast.success(`${project.name} を退勤しました`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const handleBreakStart = async () => {
    if (!activeRecord?.id) return
    try {
      await breakStart.mutateAsync(activeRecord.id)
      toast.success('休憩開始')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const handleBreakEnd = async () => {
    if (!activeRecord?.id) return
    try {
      await breakEnd.mutateAsync(activeRecord.id)
      toast.success('休憩終了')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const canClockIn = !activeRecord // 未出勤 or 退勤済みの場合は再出勤可能

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        プロジェクト選択に戻る
      </Button>

      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-mono">{project.project_code}</p>
              <CardTitle className="text-lg">{project.name}</CardTitle>
            </div>
            {activeRecord && (
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full animate-pulse ${getStatusColor(activeRecord.status)}`} />
                <Badge className={
                  activeRecord.status === 'clocked_in'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }>
                  {activeRecord.status === 'clocked_in' ? '勤務中' : '休憩中'}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* ステータス情報 */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              {activeRecord ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    出勤: {formatTime(activeRecord.clock_in)}
                  </p>
                  {elapsed && (
                    <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-mono font-semibold">{elapsed}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {status.totalRecords > 0
                    ? `本日 ${status.totalRecords} 回打刻済み — 再出勤可能`
                    : '未出勤'}
                </p>
              )}
            </div>

            {/* アクションボタン */}
            <div className="flex gap-2">
              {canClockIn && (
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 min-w-[120px]"
                  onClick={handleClockIn}
                  disabled={clockIn.isPending}
                >
                  <LogIn className="h-5 w-5 mr-2" />
                  {status.totalRecords > 0 ? (
                    <>
                      <RotateCw className="h-4 w-4 mr-1" />
                      再出勤
                    </>
                  ) : (
                    '出勤'
                  )}
                </Button>
              )}

              {activeRecord?.status === 'clocked_in' && (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleBreakStart}
                    disabled={breakStart.isPending}
                  >
                    <Coffee className="h-5 w-5 mr-2" />
                    休憩
                  </Button>
                  <Button
                    size="lg"
                    className="bg-red-600 hover:bg-red-700 min-w-[120px]"
                    onClick={handleClockOut}
                    disabled={clockOut.isPending}
                  >
                    <LogOut className="h-5 w-5 mr-2" />
                    退勤
                  </Button>
                </>
              )}

              {activeRecord?.status === 'on_break' && (
                <Button
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 min-w-[120px]"
                  onClick={handleBreakEnd}
                  disabled={breakEnd.isPending}
                >
                  <Play className="h-5 w-5 mr-2" />
                  休憩終了
                </Button>
              )}
            </div>
          </div>

          {/* このPJの今日の打刻履歴 */}
          {status.totalRecords > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">本日の打刻履歴</p>
              <div className="space-y-1.5">
                {status.records.map((r, i) => (
                  <div
                    key={r.id}
                    className="flex flex-col gap-0.5 text-sm py-1.5 px-2 rounded bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-12">{i + 1}回目</span>
                      <span className="font-mono">{formatTime(r.clock_in)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono">
                        {r.clock_out ? formatTime(r.clock_out) : '---'}
                      </span>
                      {r.work_minutes != null && r.clock_out && (
                        <span className="text-muted-foreground text-xs">
                          ({formatMinutes(r.work_minutes)})
                        </span>
                      )}
                      <Badge variant={getStatusBadgeVariant(r.status)} className="text-xs ml-auto">
                        {ATTENDANCE_STATUS_LABELS[r.status] || r.status}
                      </Badge>
                    </div>
                    {(r.break_start || r.break_minutes > 0) && (
                      <div className="flex items-center gap-2 pl-[3.75rem] text-xs text-muted-foreground">
                        <Coffee className="h-3 w-3 text-amber-500" />
                        <span className="font-mono">
                          {r.break_start ? formatTime(r.break_start) : '---'}
                        </span>
                        <span>→</span>
                        <span className="font-mono">
                          {r.break_end
                            ? formatTime(r.break_end)
                            : r.status === 'on_break'
                              ? '休憩中'
                              : '---'}
                        </span>
                        {r.break_minutes > 0 && (
                          <span>({formatMinutes(r.break_minutes)})</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ======= メインページ =======
export default function AttendancePage() {
  const [selectedProject, setSelectedProject] = useState<MyProject | null>(null)
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

  const { data: todayData } = useTodayAttendance()
  const { data: myProjects, isLoading: projectsLoading } = useMyProjects()
  const { data: recordsData, isLoading } = useAttendanceRecords({
    scope: 'self',
    date_from: dateFrom,
    date_to: dateTo,
  })

  const todayRecords = useMemo(() => todayData?.records || [], [todayData])
  const records = useMemo(() => recordsData?.data || [], [recordsData])

  const queryClient = useQueryClient()
  const [correctionTarget, setCorrectionTarget] = useState<AttendanceRecord | null>(null)
  const [editTarget, setEditTarget] = useState<AttendanceRecord | null>(null)

  const handleAdminDelete = async (id: string) => {
    if (!confirm('この打刻記録を削除しますか？この操作は取り消せません。')) return
    try {
      const res = await fetch(`/api/attendance/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '削除に失敗しました')
      }
      toast.success('打刻を削除しました')
      queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  // 管理権限の取得（admin/ownerのみ「管理用」ボタン表示）
  const [canManage, setCanManage] = useState(false)
  useEffect(() => {
    fetch('/api/auth/shift-permissions')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.role === 'owner' || d?.role === 'admin') setCanManage(true)
      })
      .catch(() => {})
  }, [])

  // 現在時刻リアルタイム表示
  const [currentTime, setCurrentTime] = useState('')
  useEffect(() => {
    const update = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Tokyo',
        })
      )
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  // アサインPJが1つだけの場合は自動選択
  useEffect(() => {
    if (myProjects && myProjects.length === 1 && !selectedProject) {
      setSelectedProject(myProjects[0])
    }
  }, [myProjects, selectedProject])

  // 月次集計
  const monthlySummary = useMemo(() => {
    const totalWork = records.reduce((sum, r) => sum + (r.work_minutes || 0), 0)
    const totalOvertime = records.reduce((sum, r) => sum + (r.overtime_minutes || 0), 0)
    const totalBreak = records.reduce((sum, r) => sum + (r.break_minutes || 0), 0)
    const workDays = new Set(records.filter((r) => r.clock_out).map((r) => r.date)).size
    return { totalWork, totalOvertime, totalBreak, workDays }
  }, [records])

  // 勤務中のPJ数
  const activeProjectCount = useMemo(() => {
    return todayRecords.filter(
      (r) => r.status === 'clocked_in' || r.status === 'on_break'
    ).length
  }, [todayRecords])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <PageHeader
          title="勤怠管理"
          description="自分の出退勤打刻と勤怠記録"
        />
        <div className="flex items-center gap-2">
          {canManage && (
            <Link
              href="/attendance/manage"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground shrink-0"
            >
              <Users className="h-4 w-4" />
              メンバー管理
            </Link>
          )}
        </div>
      </div>

      {/* 時計 + 全体ステータス */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="text-center sm:text-left">
              <p className="text-4xl font-mono font-bold tracking-wider">{currentTime}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date().toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                  timeZone: 'Asia/Tokyo',
                })}
              </p>
            </div>
            <div className="flex-1 flex items-center justify-center sm:justify-end gap-3">
              {activeProjectCount > 0 ? (
                <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1">
                  {activeProjectCount}件 勤務中
                </Badge>
              ) : todayRecords.length > 0 ? (
                <Badge variant="outline" className="text-sm px-3 py-1">
                  本日 {todayRecords.length} 件打刻済
                </Badge>
              ) : (
                <Badge variant="outline" className="text-sm px-3 py-1 text-muted-foreground">
                  未出勤
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* プロジェクト選択 or 打刻画面 */}
      {projectsLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            プロジェクトを読み込み中...
          </CardContent>
        </Card>
      ) : !myProjects || myProjects.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>アサインされているプロジェクトがありません</p>
            <p className="text-xs mt-1">管理者にプロジェクトへのアサインを依頼してください</p>
          </CardContent>
        </Card>
      ) : selectedProject ? (
        <ProjectAttendance
          project={selectedProject}
          todayRecords={todayRecords}
          onBack={() => setSelectedProject(null)}
        />
      ) : (
        <ProjectSelector
          projects={myProjects}
          todayRecords={todayRecords}
          onSelectProject={setSelectedProject}
        />
      )}

      {/* 月次サマリー */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">勤務日数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {monthlySummary.workDays}
              <span className="text-sm font-normal text-muted-foreground ml-1">日</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">総勤務時間</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMinutes(monthlySummary.totalWork)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">残業時間</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${monthlySummary.totalOvertime > 0 ? 'text-orange-500' : ''}`}
            >
              {formatMinutes(monthlySummary.totalOvertime)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">休憩時間</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMinutes(monthlySummary.totalBreak)}</p>
          </CardContent>
        </Card>
      </div>

      {/* フィルター */}
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
      </div>

      {/* 打刻一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            打刻記録
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              期間内の打刻記録はありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日付</TableHead>
                    <TableHead>プロジェクト</TableHead>
                    <TableHead>出勤</TableHead>
                    <TableHead>退勤</TableHead>
                    <TableHead>休憩</TableHead>
                    <TableHead>勤務時間</TableHead>
                    <TableHead>残業</TableHead>
                    <TableHead>場所</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {new Date(record.date).toLocaleDateString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.project ? (
                          <span>{record.project.name}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatTime(record.clock_in)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatTime(record.clock_out)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.break_minutes > 0 ? `${record.break_minutes}分` : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatMinutes(record.work_minutes)}
                      </TableCell>
                      <TableCell
                        className={`font-mono text-sm ${record.overtime_minutes > 0 ? 'text-orange-500' : ''}`}
                      >
                        {record.overtime_minutes > 0
                          ? formatMinutes(record.overtime_minutes)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.location_type
                          ? LOCATION_TYPE_LABELS[record.location_type] ||
                            record.location_type
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(record.status)}>
                          {ATTENDANCE_STATUS_LABELS[record.status] || record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => canManage ? setEditTarget(record) : setCorrectionTarget(record)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            修正
                          </Button>
                          {canManage && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-destructive hover:text-destructive"
                              onClick={() => handleAdminDelete(record.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CorrectionRequestDialog
        record={correctionTarget}
        open={!!correctionTarget}
        onOpenChange={(v) => { if (!v) setCorrectionTarget(null) }}
        onSubmitted={() => queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() })}
      />

      <AttendanceEditDialog
        record={editTarget}
        open={!!editTarget}
        onOpenChange={(v) => { if (!v) setEditTarget(null) }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() })}
      />
    </div>
  )
}
