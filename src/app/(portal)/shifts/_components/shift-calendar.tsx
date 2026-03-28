'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ShiftWithRelations } from '@/hooks/use-shifts'

interface ShiftCalendarProps {
  year: number
  month: number
  shifts: ShiftWithRelations[]
  viewMode: 'staff' | 'project'
  onDayClick: (date: string) => void
  onShiftClick: (shift: ShiftWithRelations) => void
}

const PROJECT_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-red-100 text-red-800 border-red-200',
]

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

export function ShiftCalendar({
  year,
  month,
  shifts,
  viewMode,
  onDayClick,
  onShiftClick,
}: ShiftCalendarProps) {
  const { calendarDays, projectColorMap } = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const startDow = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const days: { date: string; day: number; isCurrentMonth: boolean }[] = []

    // Previous month padding
    const prevMonthLast = new Date(year, month - 1, 0).getDate()
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthLast - i
      const prevMonth = month - 1 <= 0 ? 12 : month - 1
      const prevYear = month - 1 <= 0 ? year - 1 : year
      days.push({
        date: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isCurrentMonth: false,
      })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isCurrentMonth: true,
      })
    }

    // Next month padding
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month + 1 > 12 ? 1 : month + 1
      const nextYear = month + 1 > 12 ? year + 1 : year
      days.push({
        date: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isCurrentMonth: false,
      })
    }

    // Build project color map
    const projectNames = [...new Set(shifts.map((s) => s.project_name || '未設定'))]
    const colorMap: Record<string, string> = {}
    projectNames.forEach((name, idx) => {
      colorMap[name] = PROJECT_COLORS[idx % PROJECT_COLORS.length]
    })

    return { calendarDays: days, projectColorMap: colorMap }
  }, [year, month, shifts])

  const shiftsByDate = useMemo(() => {
    const map: Record<string, ShiftWithRelations[]> = {}
    for (const shift of shifts) {
      if (!map[shift.date]) map[shift.date] = []
      map[shift.date].push(shift)
    }
    return map
  }, [shifts])

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="rounded-lg border bg-card">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b">
        {WEEKDAY_LABELS.map((label, idx) => (
          <div
            key={label}
            className={cn(
              'px-2 py-2 text-center text-sm font-medium',
              idx === 0 && 'text-red-500',
              idx === 6 && 'text-blue-500'
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((dayInfo, idx) => {
          const dayShifts = shiftsByDate[dayInfo.date] || []
          const dow = idx % 7

          return (
            <div
              key={dayInfo.date}
              className={cn(
                'min-h-[100px] border-b border-r p-1 cursor-pointer transition-colors hover:bg-muted/50',
                !dayInfo.isCurrentMonth && 'bg-muted/30',
                dayInfo.date === today && 'bg-blue-50/50'
              )}
              onClick={() => onDayClick(dayInfo.date)}
            >
              <div
                className={cn(
                  'text-sm font-medium mb-1',
                  !dayInfo.isCurrentMonth && 'text-muted-foreground',
                  dow === 0 && 'text-red-500',
                  dow === 6 && 'text-blue-500',
                  dayInfo.date === today &&
                    'inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground'
                )}
              >
                {dayInfo.day}
              </div>

              <div className="space-y-0.5">
                {dayShifts.slice(0, 3).map((shift) => {
                  const label =
                    viewMode === 'project'
                      ? shift.project_name || '未設定'
                      : shift.staff_name || '不明'
                  const colorClass =
                    projectColorMap[shift.project_name || '未設定'] || PROJECT_COLORS[0]

                  return (
                    <button
                      key={shift.id}
                      className={cn(
                        'w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded border truncate',
                        colorClass
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        onShiftClick(shift)
                      }}
                    >
                      {shift.start_time && (
                        <span className="font-medium">{shift.start_time.slice(0, 5)}</span>
                      )}{' '}
                      {label}
                    </button>
                  )
                })}
                {dayShifts.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{dayShifts.length - 3}件
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
