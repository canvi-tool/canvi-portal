'use client'

import { useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

// --- Types ---

type ShiftStatus = 'SUBMITTED' | 'APPROVED' | 'NEEDS_REVISION'

interface ShiftItem {
  id: string
  staffId: string
  staffName: string
  projectId: string
  projectName: string
  date: string
  startTime: string
  endTime: string
  status: ShiftStatus
  notes?: string
}

interface ShiftWeeklyTimelineProps {
  weekDates: string[]
  shifts: ShiftItem[]
  onShiftClick?: (shift: ShiftItem) => void
  startHour?: number
  endHour?: number
}

// --- Project Colors (Google Calendar style) ---

const PROJECT_COLORS: Record<string, { bg: string; border: string; text: string; hoverBg: string }> = {
  pj1: { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-white', hoverBg: 'hover:bg-blue-600' },
  pj2: { bg: 'bg-violet-500', border: 'border-violet-600', text: 'text-white', hoverBg: 'hover:bg-violet-600' },
  pj3: { bg: 'bg-teal-500', border: 'border-teal-600', text: 'text-white', hoverBg: 'hover:bg-teal-600' },
  pj4: { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-white', hoverBg: 'hover:bg-amber-600' },
  pj5: { bg: 'bg-rose-500', border: 'border-rose-600', text: 'text-white', hoverBg: 'hover:bg-rose-600' },
  pj6: { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white', hoverBg: 'hover:bg-emerald-600' },
}

const FALLBACK_COLORS = [
  { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-white', hoverBg: 'hover:bg-indigo-600' },
  { bg: 'bg-pink-500', border: 'border-pink-600', text: 'text-white', hoverBg: 'hover:bg-pink-600' },
  { bg: 'bg-cyan-500', border: 'border-cyan-600', text: 'text-white', hoverBg: 'hover:bg-cyan-600' },
  { bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-white', hoverBg: 'hover:bg-orange-600' },
]

function getProjectColor(projectId: string, allProjectIds: string[]) {
  if (PROJECT_COLORS[projectId]) return PROJECT_COLORS[projectId]
  const idx = allProjectIds.indexOf(projectId)
  return FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
}

// --- Status indicator ---

const STATUS_DOT: Record<ShiftStatus, string> = {
  SUBMITTED: 'bg-amber-300',
  APPROVED: 'bg-green-300',
  NEEDS_REVISION: 'bg-orange-300',
}

// --- Helpers ---

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']
const HOUR_HEIGHT = 60 // px per hour

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function formatHourLabel(hour: number): string {
  if (hour < 12) return `午前${hour}時`
  if (hour === 12) return `午後${hour}時`
  return `午後${hour - 12}時`
}

interface LayoutColumn {
  shift: ShiftItem
  column: number
  totalColumns: number
}

function layoutOverlappingShifts(shifts: ShiftItem[]): LayoutColumn[] {
  if (shifts.length === 0) return []

  const sorted = [...shifts].sort((a, b) => {
    const aStart = timeToMinutes(a.startTime)
    const bStart = timeToMinutes(b.startTime)
    if (aStart !== bStart) return aStart - bStart
    const aDur = timeToMinutes(a.endTime) - aStart
    const bDur = timeToMinutes(b.endTime) - bStart
    return bDur - aDur
  })

  const columns: { shift: ShiftItem; end: number }[][] = []

  for (const shift of sorted) {
    const start = timeToMinutes(shift.startTime)
    const end = timeToMinutes(shift.endTime)
    let placed = false

    for (let col = 0; col < columns.length; col++) {
      const lastInCol = columns[col][columns[col].length - 1]
      if (lastInCol.end <= start) {
        columns[col].push({ shift, end })
        placed = true
        break
      }
    }

    if (!placed) {
      columns.push([{ shift, end }])
    }
  }

  const result: LayoutColumn[] = []
  const totalColumns = columns.length

  for (let col = 0; col < columns.length; col++) {
    for (const item of columns[col]) {
      result.push({ shift: item.shift, column: col, totalColumns })
    }
  }

  // Recalculate totalColumns for each group of overlapping shifts
  const groups: ShiftItem[][] = []
  const sortedAll = [...shifts].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))

  let currentGroup: ShiftItem[] = []
  let groupEnd = 0

  for (const shift of sortedAll) {
    const start = timeToMinutes(shift.startTime)
    const end = timeToMinutes(shift.endTime)

    if (currentGroup.length === 0 || start < groupEnd) {
      currentGroup.push(shift)
      groupEnd = Math.max(groupEnd, end)
    } else {
      groups.push([...currentGroup])
      currentGroup = [shift]
      groupEnd = end
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup)

  // For each group, update totalColumns
  for (const group of groups) {
    const groupIds = new Set(group.map(s => s.id))
    const groupItems = result.filter(r => groupIds.has(r.shift.id))
    const maxCol = Math.max(...groupItems.map(r => r.column)) + 1
    for (const item of groupItems) {
      item.totalColumns = maxCol
    }
  }

  return result
}

// --- Component ---

export function ShiftWeeklyTimeline({
  weekDates,
  shifts,
  onShiftClick,
  startHour = 7,
  endHour = 23,
}: ShiftWeeklyTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const totalHeight = hours.length * HOUR_HEIGHT

  const todayStr = useMemo(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  }, [])

  // Collect all unique project IDs for color assignment
  const allProjectIds = useMemo(() => {
    const ids = new Set<string>()
    shifts.forEach(s => ids.add(s.projectId))
    return Array.from(ids)
  }, [shifts])

  // Group shifts by date
  const shiftsByDate = useMemo(() => {
    const map: Record<string, ShiftItem[]> = {}
    for (const dateStr of weekDates) {
      map[dateStr] = shifts.filter(s => s.date === dateStr)
    }
    return map
  }, [shifts, weekDates])

  // Scroll to 8:00 on mount
  useEffect(() => {
    if (containerRef.current) {
      const scrollTo = (8 - startHour) * HOUR_HEIGHT
      containerRef.current.scrollTop = scrollTo
    }
  }, [startHour])

  // Current time indicator
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const currentTimeTop = ((currentMinutes - startHour * 60) / 60) * HOUR_HEIGHT
  const showCurrentTime = currentMinutes >= startHour * 60 && currentMinutes < endHour * 60

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header row - days */}
      <div className="flex border-b bg-muted/30">
        <div className="w-[68px] shrink-0 border-r" />
        {weekDates.map((dateStr) => {
          const d = new Date(dateStr + 'T00:00:00')
          const isToday = dateStr === todayStr
          const dayOfWeek = d.getDay()
          return (
            <div
              key={dateStr}
              className={cn(
                'flex-1 py-2 px-1 text-center border-r last:border-r-0 min-w-0',
                isToday && 'bg-blue-50/60'
              )}
            >
              <div className={cn(
                'text-xs font-medium',
                dayOfWeek === 0 && 'text-red-500',
                dayOfWeek === 6 && 'text-blue-500',
                dayOfWeek !== 0 && dayOfWeek !== 6 && 'text-muted-foreground'
              )}>
                {WEEKDAY_LABELS[dayOfWeek]}
              </div>
              <div className={cn(
                'text-lg font-bold',
                isToday && 'inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white',
                !isToday && dayOfWeek === 0 && 'text-red-500',
                !isToday && dayOfWeek === 6 && 'text-blue-500',
              )}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Scrollable timeline body */}
      <div
        ref={containerRef}
        className="overflow-y-auto overflow-x-auto"
        style={{ maxHeight: '680px' }}
      >
        <div className="flex" style={{ minHeight: `${totalHeight}px` }}>
          {/* Hour labels column */}
          <div className="w-[68px] shrink-0 border-r relative">
            {hours.map((hour, i) => (
              <div
                key={hour}
                className="absolute w-full text-right pr-2"
                style={{
                  top: `${i * HOUR_HEIGHT}px`,
                  height: `${HOUR_HEIGHT}px`,
                }}
              >
                <span className="text-[11px] text-muted-foreground leading-none relative -top-2">
                  {formatHourLabel(hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((dateStr) => {
            const dayShifts = shiftsByDate[dateStr] || []
            const layout = layoutOverlappingShifts(dayShifts)
            const isToday = dateStr === todayStr

            return (
              <div
                key={dateStr}
                className={cn(
                  'flex-1 border-r last:border-r-0 relative min-w-0',
                  isToday && 'bg-blue-50/30'
                )}
                style={{ height: `${totalHeight}px` }}
              >
                {/* Hour grid lines */}
                {hours.map((hour, i) => (
                  <div
                    key={hour}
                    className="absolute w-full border-b border-gray-100"
                    style={{
                      top: `${i * HOUR_HEIGHT}px`,
                      height: `${HOUR_HEIGHT}px`,
                    }}
                  >
                    {/* Half hour line */}
                    <div
                      className="absolute w-full border-b border-gray-50"
                      style={{ top: `${HOUR_HEIGHT / 2}px` }}
                    />
                  </div>
                ))}

                {/* Current time indicator */}
                {isToday && showCurrentTime && (
                  <div
                    className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                    style={{ top: `${currentTimeTop}px` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shrink-0" />
                    <div className="flex-1 h-[2px] bg-red-500" />
                  </div>
                )}

                {/* Shift blocks */}
                {layout.map(({ shift, column, totalColumns }) => {
                  const startMin = timeToMinutes(shift.startTime) - startHour * 60
                  const endMin = timeToMinutes(shift.endTime) - startHour * 60
                  const top = (startMin / 60) * HOUR_HEIGHT
                  const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT - 2, 20)

                  const colWidth = 100 / totalColumns
                  const left = column * colWidth
                  const width = colWidth

                  const color = getProjectColor(shift.projectId, allProjectIds)
                  const durationMinutes = endMin - startMin
                  const isShort = durationMinutes < 60

                  return (
                    <div
                      key={shift.id}
                      className={cn(
                        'absolute rounded-md border-l-[3px] shadow-sm cursor-pointer transition-opacity z-10',
                        color.bg,
                        color.border,
                        color.text,
                        color.hoverBg,
                        'opacity-90 hover:opacity-100 hover:z-30'
                      )}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `${left}%`,
                        width: `calc(${width}% - 2px)`,
                        marginLeft: '1px',
                      }}
                      onClick={() => onShiftClick?.(shift)}
                      title={`${shift.staffName} - ${shift.projectName}\n${shift.startTime}〜${shift.endTime}`}
                    >
                      <div className={cn(
                        'px-1.5 py-0.5 overflow-hidden h-full',
                        isShort ? 'flex items-center gap-1' : ''
                      )}>
                        {/* Status dot */}
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[shift.status])} />
                          <span className="text-[11px] font-semibold truncate leading-tight">
                            {shift.projectName}
                          </span>
                        </div>
                        {!isShort && (
                          <>
                            <div className="text-[10px] opacity-90 truncate leading-tight">
                              {shift.startTime}〜{shift.endTime}
                            </div>
                            <div className="text-[10px] opacity-80 truncate leading-tight">
                              {shift.staffName}
                            </div>
                          </>
                        )}
                        {isShort && (
                          <span className="text-[10px] opacity-80 truncate">
                            {shift.staffName}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Project legend */}
      <div className="border-t px-4 py-2 flex items-center gap-4 flex-wrap bg-muted/20">
        {allProjectIds.map(pid => {
          const color = getProjectColor(pid, allProjectIds)
          const projectName = shifts.find(s => s.projectId === pid)?.projectName || pid
          return (
            <div key={pid} className="flex items-center gap-1.5">
              <span className={cn('inline-block w-3 h-3 rounded-sm', color.bg)} />
              <span className="text-xs text-muted-foreground">{projectName}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
