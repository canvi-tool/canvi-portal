'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  useTodayAttendance,
  useClockIn,
  useClockOut,
  useBreakStart,
  useBreakEnd,
} from '@/hooks/use-attendance'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogIn, LogOut, Coffee, Play, Timer } from 'lucide-react'
import { toast } from 'sonner'

function formatElapsed(startStr: string, breakMinutes = 0) {
  const start = new Date(startStr).getTime()
  const elapsed = Math.floor((Date.now() - start) / 60000) - breakMinutes
  const h = Math.floor(Math.max(0, elapsed) / 60)
  const m = Math.max(0, elapsed) % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function formatTime(s: string) {
  return new Date(s).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })
}

interface Props {
  projectId: string
  projectName?: string
  /** 'card' = プロジェクト詳細用フル, 'inline' = ポップオーバー用コンパクト */
  variant?: 'card' | 'inline'
}

/**
 * 指定プロジェクト単体の勤怠ステータス + 出退勤/休憩ボタン
 */
export function ProjectClockControls({ projectId, projectName, variant = 'card' }: Props) {
  const { data: todayData } = useTodayAttendance()
  const clockIn = useClockIn()
  const clockOut = useClockOut()
  const breakStart = useBreakStart()
  const breakEnd = useBreakEnd()
  const [tick, setTick] = useState(0)

  // このPJの今日のレコードを取得（最新の active or 最新）
  const records = (todayData?.records || []).filter(r => r.project_id === projectId)
  const activeRecord = records.find(r => r.status === 'clocked_in' || r.status === 'on_break')
  const record = activeRecord || records[0] || null
  const status: string = record?.status || 'not_clocked_in'

  // 経過時間を1分ごとに更新
  useEffect(() => {
    if (status !== 'clocked_in') return
    const i = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(i)
  }, [status])

  const elapsed = record?.clock_in && status !== 'clocked_out'
    ? formatElapsed(record.clock_in, record.break_minutes || 0)
    : null
  void tick // for re-render

  const handleClockIn = useCallback(async () => {
    try {
      await clockIn.mutateAsync({ project_id: projectId, location_type: 'remote' })
      toast.success(`${projectName || 'PJ'}に出勤しました`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [clockIn, projectId, projectName])

  const handleClockOut = useCallback(async () => {
    if (!record?.id) return
    try {
      await clockOut.mutateAsync(record.id)
      toast.success(`${projectName || 'PJ'}を退勤しました`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [clockOut, record, projectName])

  const handleBreakStart = useCallback(async () => {
    if (!record?.id) return
    try {
      await breakStart.mutateAsync(record.id)
      toast.success('休憩開始')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [breakStart, record])

  const handleBreakEnd = useCallback(async () => {
    if (!record?.id) return
    try {
      await breakEnd.mutateAsync(record.id)
      toast.success('休憩終了')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }, [breakEnd, record])

  const statusConfig: Record<string, { label: string; dot: string; color: string }> = {
    not_clocked_in: { label: '未出勤', dot: 'bg-gray-400', color: 'text-muted-foreground' },
    clocked_in: { label: '勤務中', dot: 'bg-green-500', color: 'text-green-600' },
    on_break: { label: '休憩中', dot: 'bg-yellow-500', color: 'text-yellow-600' },
    clocked_out: { label: '退勤済', dot: 'bg-blue-500', color: 'text-blue-600' },
    modified: { label: '修正済', dot: 'bg-orange-500', color: 'text-orange-600' },
    approved: { label: '承認済', dot: 'bg-green-600', color: 'text-green-700' },
  }
  const sc = statusConfig[status] || statusConfig.not_clocked_in

  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-between gap-2 py-2 px-2 rounded-md hover:bg-muted/50">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`h-2 w-2 rounded-full shrink-0 ${sc.dot}`} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{projectName || 'PJ'}</p>
            <p className="text-[10px] text-muted-foreground">
              <span className={sc.color}>{sc.label}</span>
              {elapsed && <span className="ml-1 font-mono">{elapsed}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {status === 'not_clocked_in' && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
              onClick={handleClockIn} disabled={clockIn.isPending}>
              <LogIn className="h-3 w-3 mr-0.5" />出勤
            </Button>
          )}
          {status === 'clocked_in' && (
            <>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                onClick={handleBreakStart} disabled={breakStart.isPending}>
                <Coffee className="h-3 w-3" />
              </Button>
              <Button size="sm" className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700"
                onClick={handleClockOut} disabled={clockOut.isPending}>
                <LogOut className="h-3 w-3 mr-0.5" />退勤
              </Button>
            </>
          )}
          {status === 'on_break' && (
            <Button size="sm" className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={handleBreakEnd} disabled={breakEnd.isPending}>
              <Play className="h-3 w-3 mr-0.5" />終了
            </Button>
          )}
        </div>
      </div>
    )
  }

  // card variant (project detail page)
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {(status === 'clocked_in' || status === 'on_break') && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sc.dot} opacity-75`} />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${sc.dot}`} />
          </span>
          <Badge variant={status === 'clocked_in' ? 'default' : status === 'on_break' ? 'secondary' : 'outline'}>
            {sc.label}
          </Badge>
          {record?.clock_in && (
            <span className="text-xs text-muted-foreground">出勤 {formatTime(record.clock_in)}</span>
          )}
          {record?.clock_out && (
            <span className="text-xs text-muted-foreground">退勤 {formatTime(record.clock_out)}</span>
          )}
        </div>
        {elapsed && status === 'clocked_in' && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" />
            <span className="font-mono font-semibold">{elapsed}</span>
          </div>
        )}
      </div>

      {record && (record.break_minutes || 0) > 0 && (
        <p className="text-xs text-muted-foreground">休憩: {record.break_minutes}分</p>
      )}

      <div className="flex gap-2">
        {status === 'not_clocked_in' && (
          <Button className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={handleClockIn} disabled={clockIn.isPending}>
            <LogIn className="h-4 w-4 mr-2" />
            {clockIn.isPending ? '処理中...' : 'このPJで出勤'}
          </Button>
        )}
        {status === 'clocked_in' && (
          <>
            <Button variant="outline" className="flex-1"
              onClick={handleBreakStart} disabled={breakStart.isPending}>
              <Coffee className="h-4 w-4 mr-2" />休憩
            </Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={handleClockOut} disabled={clockOut.isPending}>
              <LogOut className="h-4 w-4 mr-2" />退勤
            </Button>
          </>
        )}
        {status === 'on_break' && (
          <Button className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={handleBreakEnd} disabled={breakEnd.isPending}>
            <Play className="h-4 w-4 mr-2" />休憩終了
          </Button>
        )}
        {(status === 'clocked_out' || status === 'modified' || status === 'approved') && (
          <div className="flex-1 text-center text-sm text-muted-foreground py-2">
            本日のこのPJの勤怠は記録済みです
          </div>
        )}
      </div>
    </div>
  )
}
