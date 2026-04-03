'use client'

import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { useAttendanceRecords, useTodayAttendance, useClockIn, useClockOut, useBreakStart, useBreakEnd } from '@/hooks/use-attendance'
import { useProjects } from '@/hooks/use-projects'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  LogIn,
  LogOut,
  Coffee,
  Play,
  Timer,
  Clock,
  Calendar,
} from 'lucide-react'

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

export default function AttendancePage() {
  // sonner toast is imported at top level
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(1) // 月初
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

  const { data: todayData } = useTodayAttendance()
  const { data: projects } = useProjects()
  const { data: recordsData, isLoading } = useAttendanceRecords({
    date_from: dateFrom,
    date_to: dateTo,
  })

  const clockIn = useClockIn()
  const clockOut = useClockOut()
  const breakStart = useBreakStart()
  const breakEnd = useBreakEnd()

  const records = recordsData?.data || []
  const todayStatus = todayData?.status || 'not_clocked_in'
  const todayRecord = todayData?.record

  // 月次集計
  const monthlySummary = useMemo(() => {
    const totalWork = records.reduce((sum, r) => sum + (r.work_minutes || 0), 0)
    const totalOvertime = records.reduce((sum, r) => sum + (r.overtime_minutes || 0), 0)
    const totalBreak = records.reduce((sum, r) => sum + (r.break_minutes || 0), 0)
    const workDays = records.filter(r => r.clock_out).length
    return { totalWork, totalOvertime, totalBreak, workDays }
  }, [records])

  // 現在時刻リアルタイム表示用
  const [currentTime, setCurrentTime] = useState('')
  const [elapsed, setElapsed] = useState('')

  useState(() => {
    const update = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Tokyo',
        })
      )
      if (todayRecord?.clock_in && todayStatus !== 'clocked_out') {
        const start = new Date(todayRecord.clock_in).getTime()
        const now = Date.now()
        const mins = Math.floor((now - start) / 60000) - (todayRecord.break_minutes || 0)
        const h = Math.floor(mins / 60)
        const m = mins % 60
        setElapsed(`${h}h ${m.toString().padStart(2, '0')}m`)
      }
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  })

  const handleClockIn = async () => {
    try {
      await clockIn.mutateAsync({
        project_id: selectedProject || undefined,
        location_type: 'remote',
      })
      toast.success('出勤しました')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const handleClockOut = async () => {
    if (!todayRecord?.id) return
    try {
      await clockOut.mutateAsync(todayRecord.id)
      toast.success('退勤しました')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const handleBreakStart = async () => {
    if (!todayRecord?.id) return
    try {
      await breakStart.mutateAsync(todayRecord.id)
      toast.success('休憩開始')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const handleBreakEnd = async () => {
    if (!todayRecord?.id) return
    try {
      await breakEnd.mutateAsync(todayRecord.id)
      toast.success('休憩終了')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="勤怠管理"
        description="出退勤の打刻と勤怠記録の管理を行います。"
      />

      {/* 打刻カード */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* 現在時刻 */}
            <div className="text-center sm:text-left">
              <p className="text-4xl font-mono font-bold tracking-wider">{currentTime}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date().toLocaleDateString('ja-JP', {
                  year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
                  timeZone: 'Asia/Tokyo',
                })}
              </p>
            </div>

            {/* ステータス */}
            <div className="flex-1 flex flex-col items-center gap-2">
              {todayStatus === 'clocked_in' && (
                <>
                  <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1">勤務中</Badge>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Timer className="h-4 w-4" />
                    <span className="text-xl font-mono font-semibold">{elapsed}</span>
                  </div>
                </>
              )}
              {todayStatus === 'on_break' && (
                <Badge className="bg-yellow-100 text-yellow-700 text-sm px-3 py-1">休憩中</Badge>
              )}
              {todayStatus === 'clocked_out' && (
                <Badge variant="outline" className="text-sm px-3 py-1">退勤済</Badge>
              )}
              {todayStatus === 'not_clocked_in' && (
                <Badge variant="outline" className="text-sm px-3 py-1 text-muted-foreground">未出勤</Badge>
              )}
              {todayRecord?.clock_in && (
                <p className="text-xs text-muted-foreground">
                  出勤: {formatTime(todayRecord.clock_in)}
                  {todayRecord.clock_out && ` / 退勤: ${formatTime(todayRecord.clock_out)}`}
                </p>
              )}
            </div>

            {/* PJ選択 + アクションボタン */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {todayStatus === 'not_clocked_in' && projects && projects.length > 0 && (
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="PJ選択（任意）" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.filter(p => p.status === 'active').map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.project_code} - {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {todayStatus === 'not_clocked_in' && (
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 min-w-[120px]"
                  onClick={handleClockIn}
                  disabled={clockIn.isPending}
                >
                  <LogIn className="h-5 w-5 mr-2" />
                  {clockIn.isPending ? '処理中...' : '出勤'}
                </Button>
              )}

              {todayStatus === 'clocked_in' && (
                <div className="flex gap-2">
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
                </div>
              )}

              {todayStatus === 'on_break' && (
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
        </CardContent>
      </Card>

      {/* 月次サマリー */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-normal">勤務日数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{monthlySummary.workDays}<span className="text-sm font-normal text-muted-foreground ml-1">日</span></p>
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
            <p className={`text-2xl font-bold ${monthlySummary.totalOvertime > 0 ? 'text-orange-500' : ''}`}>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {new Date(record.date).toLocaleDateString('ja-JP', {
                          month: 'short', day: 'numeric', weekday: 'short',
                        })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.project ? (
                          <span>{record.project.project_code}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{formatTime(record.clock_in)}</TableCell>
                      <TableCell className="font-mono text-sm">{formatTime(record.clock_out)}</TableCell>
                      <TableCell className="text-sm">
                        {record.break_minutes > 0 ? `${record.break_minutes}分` : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{formatMinutes(record.work_minutes)}</TableCell>
                      <TableCell className={`font-mono text-sm ${record.overtime_minutes > 0 ? 'text-orange-500' : ''}`}>
                        {record.overtime_minutes > 0 ? formatMinutes(record.overtime_minutes) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.location_type ? LOCATION_TYPE_LABELS[record.location_type] || record.location_type : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(record.status)}>
                          {ATTENDANCE_STATUS_LABELS[record.status] || record.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
