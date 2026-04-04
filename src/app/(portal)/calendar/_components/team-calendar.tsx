'use client'

import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DatesSetArg, DateSelectArg, EventContentArg } from '@fullcalendar/core'
import '../../../(portal)/shifts/_components/fullcalendar-overrides.css'

interface BusyBlock {
  start: string
  end: string
  source: 'shift' | 'google'
}

interface MemberData {
  id: string
  email: string
  displayName: string
  busy: BusyBlock[]
}

interface TeamCalendarProps {
  members: MemberData[]
  selectedMemberIds: Set<string>
  onSlotSelect: (date: string, startTime: string, endTime: string) => void
  onDateRangeChange: (start: string, end: string) => void
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1']

// メンバーの予定をFullCalendarイベントに変換
function toEvents(members: MemberData[], selectedIds: Set<string>) {
  const events: Array<{
    id: string
    title: string
    start: string
    end: string
    backgroundColor: string
    borderColor: string
    textColor: string
    display: string
  }> = []

  const selectedMembers = members.filter(m => selectedIds.has(m.id))

  selectedMembers.forEach((member, idx) => {
    const color = COLORS[idx % COLORS.length]

    member.busy.forEach((block, blockIdx) => {
      events.push({
        id: `${member.id}-${blockIdx}`,
        title: `${member.displayName}${block.source === 'google' ? '' : ' (シフト)'}`,
        start: block.start,
        end: block.end,
        backgroundColor: block.source === 'google' ? '#94a3b8' : color,
        borderColor: block.source === 'google' ? '#94a3b8' : color,
        textColor: '#fff',
        display: 'block',
      })
    })
  })

  return events
}

// 全員が空いている時間帯のbackgroundイベント
function getAvailableSlots(
  members: MemberData[],
  selectedIds: Set<string>,
  startDate: string,
  endDate: string
) {
  const selectedMembers = members.filter(m => selectedIds.has(m.id))
  if (selectedMembers.length < 2) return []

  // 簡易的に30分スロットで空き判定
  const slots: Array<{
    id: string
    start: string
    end: string
    display: string
    backgroundColor: string
    classNames: string[]
  }> = []

  const start = new Date(startDate + 'T07:00:00+09:00')
  const end = new Date(endDate + 'T23:00:00+09:00')
  const slotDuration = 30 * 60 * 1000

  for (let t = start.getTime(); t < end.getTime(); t += slotDuration) {
    const slotStart = new Date(t)
    const slotEnd = new Date(t + slotDuration)

    // 7:00-23:00のみ
    const hour = slotStart.getHours()
    if (hour < 7 || hour >= 23) continue

    // 全員がこのスロットで空いているか
    const allFree = selectedMembers.every(member => {
      return !member.busy.some(b => {
        const busyStart = new Date(b.start).getTime()
        const busyEnd = new Date(b.end).getTime()
        return slotStart.getTime() < busyEnd && slotEnd.getTime() > busyStart
      })
    })

    if (allFree) {
      slots.push({
        id: `avail-${t}`,
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        display: 'background',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        classNames: ['available-slot'],
      })
    }
  }

  return slots
}

function renderEventContent(eventInfo: EventContentArg) {
  if (eventInfo.event.display === 'background') return null
  return (
    <div className="text-[10px] p-0.5 overflow-hidden">
      <div className="font-medium truncate">{eventInfo.event.title}</div>
      <div className="opacity-75">
        {eventInfo.timeText}
      </div>
    </div>
  )
}

export function TeamCalendar({
  members,
  selectedMemberIds,
  onSlotSelect,
  onDateRangeChange,
}: TeamCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const [viewType, setViewType] = useState<string>('timeGridWeek')
  const [title, setTitle] = useState('')
  const [currentDates, setCurrentDates] = useState({ start: '', end: '' })

  const events = useMemo(() => [
    ...toEvents(members, selectedMemberIds),
    ...getAvailableSlots(members, selectedMemberIds, currentDates.start, currentDates.end),
  ], [members, selectedMemberIds, currentDates.start, currentDates.end])

  const handleDatesSet = useCallback((dateInfo: DatesSetArg) => {
    const start = formatDate(dateInfo.start)
    const end = formatDate(dateInfo.end)
    setCurrentDates({ start, end })
    onDateRangeChange(start, end)
    setViewType(dateInfo.view.type)
    setTimeout(() => setTitle(calendarRef.current?.getApi().view.title || ''), 10)
  }, [onDateRangeChange])

  const handleSelect = useCallback((info: DateSelectArg) => {
    const date = formatDate(info.start)
    const startTime = formatTime(info.start)
    const endTime = formatTime(info.end)
    onSlotSelect(date, startTime, endTime)
  }, [onSlotSelect])

  const goToday = useCallback(() => calendarRef.current?.getApi().today(), [])
  const goPrev = useCallback(() => calendarRef.current?.getApi().prev(), [])
  const goNext = useCallback(() => calendarRef.current?.getApi().next(), [])

  const changeView = useCallback((view: string) => {
    calendarRef.current?.getApi().changeView(view)
    setViewType(view)
  }, [])

  useEffect(() => {
    setTimeout(() => setTitle(calendarRef.current?.getApi().view.title || ''), 50)
  }, [viewType])

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-input bg-background hover:bg-accent transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span className="text-sm font-semibold min-w-[180px] text-center">{title}</span>
          <button
            onClick={goNext}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-input bg-background hover:bg-accent transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <button
            onClick={goToday}
            className="ml-1 h-8 px-3 text-xs rounded-md hover:bg-accent transition-colors"
          >
            今日
          </button>
        </div>

        <div className="inline-flex h-8 items-center rounded-md border bg-muted p-0.5">
          {([
            ['timeGridWeek', '週'],
            ['timeGridDay', '日'],
          ] as const).map(([view, label]) => (
            <button
              key={view}
              onClick={() => changeView(view)}
              className={`text-xs px-3 h-6 rounded-sm transition-colors ${
                viewType === view
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      {selectedMemberIds.size >= 2 && (
        <div className="flex items-center gap-3 mb-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(16, 185, 129, 0.3)' }} />
            <span className="text-muted-foreground">全員空き</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-slate-400" />
            <span className="text-muted-foreground">Google予定</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-muted-foreground">シフト</span>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="border rounded-lg overflow-hidden bg-background">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale="ja"
          firstDay={0}
          headerToolbar={false}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="23:00:00"
          slotDuration="00:30:00"
          slotLabelInterval="01:00"
          allDaySlot={false}
          nowIndicator={true}
          selectable={true}
          selectMirror={true}
          events={events}
          eventContent={renderEventContent}
          select={handleSelect}
          datesSet={handleDatesSet}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
          dayHeaderFormat={{
            weekday: 'short',
            month: 'numeric',
            day: 'numeric',
            omitCommas: true,
          }}
        />
      </div>
    </div>
  )
}
