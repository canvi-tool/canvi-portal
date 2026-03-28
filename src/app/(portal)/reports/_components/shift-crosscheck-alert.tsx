'use client'

import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ShiftCrosscheckAlertProps {
  shiftSummary: {
    shift_days: number
    shift_total_hours: number
    hours_diff: number
  } | null
  reportedHours: number
  reportedDays: number
}

export function ShiftCrosscheckAlert({
  shiftSummary,
  reportedHours,
  reportedDays,
}: ShiftCrosscheckAlertProps) {
  if (!shiftSummary) {
    return (
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-blue-700">
            <Info className="h-4 w-4" />
            <span className="text-sm">
              この期間のシフトデータがありません。クロスチェックを行うにはシフトを登録してください。
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const hoursDiff = Math.abs(shiftSummary.hours_diff)
  const daysDiff = Math.abs(reportedDays - shiftSummary.shift_days)
  const hasSignificantDiff = hoursDiff > 1 || daysDiff > 0
  const hasCriticalDiff = hoursDiff > 8 || daysDiff > 2

  return (
    <Card
      className={cn(
        'border',
        hasCriticalDiff
          ? 'border-red-200 bg-red-50/50'
          : hasSignificantDiff
            ? 'border-yellow-200 bg-yellow-50/50'
            : 'border-green-200 bg-green-50/50'
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {hasCriticalDiff ? (
            <>
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-red-700">シフトとの差異（要確認）</span>
            </>
          ) : hasSignificantDiff ? (
            <>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-yellow-700">シフトとの差異あり</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-green-700">シフトと一致</span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">項目</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">シフト</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">報告</p>
          </div>

          <div>勤務日数</div>
          <div className="text-right">{shiftSummary.shift_days}日</div>
          <div
            className={cn(
              'text-right',
              daysDiff > 0 && 'font-medium text-orange-600'
            )}
          >
            {reportedDays}日
            {daysDiff > 0 && (
              <span className="text-xs ml-1">({daysDiff > 0 ? '+' : ''}{reportedDays - shiftSummary.shift_days})</span>
            )}
          </div>

          <div>勤務時間</div>
          <div className="text-right">{shiftSummary.shift_total_hours}h</div>
          <div
            className={cn(
              'text-right',
              hoursDiff > 1 && 'font-medium text-orange-600'
            )}
          >
            {reportedHours}h
            {hoursDiff > 1 && (
              <span className="text-xs ml-1">
                ({shiftSummary.hours_diff > 0 ? '-' : '+'}
                {hoursDiff}h)
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
