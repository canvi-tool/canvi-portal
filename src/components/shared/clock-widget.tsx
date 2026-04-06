'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTodayAttendance, useClockIn, useClockOut, useBreakStart, useBreakEnd, useBulkBreakStart, useBulkBreakEnd } from '@/hooks/use-attendance'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LogIn, LogOut, Coffee, Play, Timer } from 'lucide-react'
import { useProjects } from '@/hooks/use-projects'
import { toast } from 'sonner'

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })
}

function formatElapsedTime(startStr: string, breakMinutes: number = 0) {
  const start = new Date(startStr).getTime()
  const now = Date.now()
  const elapsedMinutes = Math.floor((now - start) / 60000) - breakMinutes
  const hours = Math.floor(Math.max(0, elapsedMinutes) / 60)
  const minutes = Math.max(0, elapsedMinutes) % 60
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`
}

// ヘッダー用コンパクトウィジェット
export function ClockWidgetCompact() {
  const { data: todayData, isLoading } = useTodayAttendance()
  const clockInMutation = useClockIn()
  const clockOutMutation = useClockOut()
  const breakStartMutation = useBreakStart()
  const breakEndMutation = useBreakEnd()
  const bulkBreakStartMutation = useBulkBreakStart()
  const bulkBreakEndMutation = useBulkBreakEnd()
  const { data: projects } = useProjects()
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [currentTime, setCurrentTime] = useState('')
  const [elapsed, setElapsed] = useState('')

  // 現在時刻の更新
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
      if (todayData?.record?.clock_in && todayData.status !== 'clocked_out') {
        setElapsed(formatElapsedTime(todayData.record.clock_in, todayData.record.break_minutes))
      }
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [todayData])

  const handleClockIn = useCallback(async () => {
    try {
      await clockInMutation.mutateAsync({
        project_id: selectedProject || undefined,
        location_type: 'remote',
      })
      toast.success('出勤しました')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [clockInMutation, selectedProject])

  const handleClockOut = useCallback(async () => {
    if (!todayData?.record?.id) return
    try {
      await clockOutMutation.mutateAsync(todayData.record.id)
      toast.success(`退勤しました（勤務時間: ${elapsed}）`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [clockOutMutation, todayData, elapsed])

  const handleBreakStart = useCallback(async () => {
    if (!todayData?.record?.id) return
    try {
      await breakStartMutation.mutateAsync(todayData.record.id)
      toast.success('休憩開始')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [breakStartMutation, todayData])

  const handleBreakEnd = useCallback(async () => {
    if (!todayData?.record?.id) return
    try {
      await breakEndMutation.mutateAsync(todayData.record.id)
      toast.success('休憩終了')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [breakEndMutation, todayData])

  const handleBulkBreakStart = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await bulkBreakStartMutation.mutateAsync()
      toast.success(`${res.count}件のPJで休憩開始`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [bulkBreakStartMutation])

  const handleBulkBreakEnd = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await bulkBreakEndMutation.mutateAsync()
      toast.success(`${res.count}件のPJで休憩終了`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [bulkBreakEndMutation])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-gray-400" />
        <span className="text-xs">--:--</span>
      </div>
    )
  }

  const status = todayData?.status || 'not_clocked_in'
  const record = todayData?.record

  const statusConfig: Record<string, { label: string; color: string; dotColor: string }> = {
    not_clocked_in: { label: '未出勤', color: 'text-muted-foreground', dotColor: 'bg-gray-400' },
    clocked_in: { label: '勤務中', color: 'text-green-600', dotColor: 'bg-green-500' },
    on_break: { label: '休憩中', color: 'text-yellow-600', dotColor: 'bg-yellow-500' },
    clocked_out: { label: '退勤済', color: 'text-blue-600', dotColor: 'bg-blue-500' },
    modified: { label: '修正済', color: 'text-orange-600', dotColor: 'bg-orange-500' },
    approved: { label: '承認済', color: 'text-green-700', dotColor: 'bg-green-600' },
  }

  const currentStatus = statusConfig[status] || statusConfig.not_clocked_in

  const records = todayData?.records || []
  const activeRecords = records.filter(r => r.status === 'clocked_in')
  const onBreakRecords = records.filter(r => r.status === 'on_break')
  const showBulkBreakStart = activeRecords.length >= 1 && onBreakRecords.length === 0
  const showBulkBreakEnd = onBreakRecords.length >= 1
  const hasMultiplePJ = (activeRecords.length + onBreakRecords.length) > 1

  return (
    <div className="flex items-center gap-1">
      {hasMultiplePJ && showBulkBreakStart && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs"
          onClick={handleBulkBreakStart}
          disabled={bulkBreakStartMutation.isPending}
          title={`${activeRecords.length}件のPJで一括休憩開始`}
        >
          <Coffee className="h-3.5 w-3.5 mr-1" />
          休憩({activeRecords.length})
        </Button>
      )}
      {hasMultiplePJ && showBulkBreakEnd && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
          onClick={handleBulkBreakEnd}
          disabled={bulkBreakEndMutation.isPending}
          title={`${onBreakRecords.length}件のPJで一括休憩終了`}
        >
          <Play className="h-3.5 w-3.5 mr-1" />
          終了({onBreakRecords.length})
        </Button>
      )}
    <Popover>
      <PopoverTrigger
        className="inline-flex items-center gap-2 h-9 px-3 rounded-md hover:bg-muted transition-colors cursor-pointer"
      >
        <span className="relative flex h-2 w-2">
          {(status === 'clocked_in' || status === 'on_break') && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${currentStatus.dotColor} opacity-75`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${currentStatus.dotColor}`} />
        </span>
        <span className={`text-xs font-medium ${currentStatus.color}`}>
          {currentStatus.label}
        </span>
        {status === 'clocked_in' && elapsed && (
          <span className="text-xs text-muted-foreground font-mono">{elapsed}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          {/* 現在時刻 */}
          <div className="text-center">
            <p className="text-3xl font-mono font-bold tracking-wider">{currentTime}</p>
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

          {/* ステータス */}
          <div className="flex items-center justify-center gap-2">
            <Badge variant={status === 'clocked_in' ? 'default' : status === 'on_break' ? 'secondary' : 'outline'}>
              {currentStatus.label}
            </Badge>
            {record?.clock_in && (
              <span className="text-sm text-muted-foreground">
                出勤: {formatTime(record.clock_in)}
              </span>
            )}
            {record?.clock_out && (
              <span className="text-sm text-muted-foreground">
                退勤: {formatTime(record.clock_out)}
              </span>
            )}
          </div>

          {/* 勤務時間 */}
          {status === 'clocked_in' && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <Timer className="h-4 w-4" />
                <span className="text-lg font-mono font-semibold">{elapsed}</span>
              </div>
              {record && record.break_minutes > 0 && (
                <p className="text-xs text-muted-foreground">休憩: {record.break_minutes}分</p>
              )}
            </div>
          )}

          {record?.work_minutes != null && status === 'clocked_out' && (
            <div className="text-center text-sm text-muted-foreground">
              勤務時間: {Math.floor(record.work_minutes / 60)}h {record.work_minutes % 60}m
              {record.overtime_minutes > 0 && (
                <span className="text-orange-500 ml-2">
                  (残業 {Math.floor(record.overtime_minutes / 60)}h {record.overtime_minutes % 60}m)
                </span>
              )}
            </div>
          )}

          {/* PJ選択（未出勤時のみ） */}
          {status === 'not_clocked_in' && projects && projects.length > 0 && (
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="プロジェクトを選択（任意）" />
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

          {/* アクションボタン */}
          <div className="flex gap-2">
            {status === 'not_clocked_in' && (
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleClockIn}
                disabled={clockInMutation.isPending}
              >
                <LogIn className="h-4 w-4 mr-2" />
                {clockInMutation.isPending ? '処理中...' : '出勤'}
              </Button>
            )}

            {status === 'clocked_in' && (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleBreakStart}
                  disabled={breakStartMutation.isPending}
                >
                  <Coffee className="h-4 w-4 mr-2" />
                  休憩
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={handleClockOut}
                  disabled={clockOutMutation.isPending}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  退勤
                </Button>
              </>
            )}

            {status === 'on_break' && (
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleBreakEnd}
                disabled={breakEndMutation.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                休憩終了
              </Button>
            )}

            {(status === 'clocked_out' || status === 'modified' || status === 'approved') && (
              <div className="flex-1 text-center text-sm text-muted-foreground py-2">
                本日の勤怠は記録済みです
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
    </div>
  )
}
