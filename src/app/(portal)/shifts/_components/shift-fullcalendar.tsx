'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventApi, EventDropArg, EventContentArg, DatesSetArg, DateSelectArg } from '@fullcalendar/core'
import type { EventResizeDoneArg, DateClickArg } from '@fullcalendar/interaction'
import { toast } from 'sonner'
import { getStaffColor, getStaffColorTransparent, STATUS_COLORS, SHIFT_TYPE_COLORS } from './shift-colors'
import { ShiftContextMenu, type ContextMenuAction } from './shift-context-menu'
import './fullcalendar-overrides.css'
import { isJpHoliday } from '@/lib/jp-holidays'

type ShiftStatus = 'SUBMITTED' | 'APPROVED' | 'NEEDS_REVISION'

export interface CalendarShift {
  id: string
  staffId: string
  staffName: string
  projectId: string
  projectName: string
  date: string
  startTime: string
  endTime: string
  status: ShiftStatus
  shiftType: string
  notes?: string
  googleMeetUrl?: string | null
  googleEventId?: string | null
  approvalMode: 'AUTO' | 'APPROVAL'
  attendees?: Array<{ email: string; name?: string; staff_id?: string }>
  isVirtualAttendee?: boolean
  ownerShiftId?: string
  source?: 'manual' | 'google_calendar' | 'import'
  needsProjectAssignment?: boolean
}

export interface GoogleCalendarEvent {
  id: string
  summary: string
  start: string
  end: string
  description?: string
  location?: string
  meetUrl?: string | null
}

interface ShiftFullCalendarProps {
  shifts: CalendarShift[]
  googleEvents?: GoogleCalendarEvent[]
  isManager: boolean
  currentStaffId?: string
  onShiftClick: (shift: CalendarShift) => void
  onShiftDragUpdate: (shiftId: string, date: string, startTime: string, endTime: string) => Promise<boolean>
  onShiftCopy: (shiftId: string, targetDate: string) => void
  onShiftDelete: (shiftId: string) => void
  onSlotSelect: (date: string, startTime: string, endTime: string) => void
  onDateRangeChange: (start: string, end: string) => void
  onGoogleEventClick?: (event: GoogleCalendarEvent) => void
  onGoogleEventDragUpdate?: (eventId: string, startDateTime: string, endDateTime: string) => Promise<boolean>
}

function toFullCalendarEvents(shifts: CalendarShift[]) {
  return shifts.map((s) => {
    const isPending = !!s.needsProjectAssignment && s.id.startsWith('gcal_pending__')
    const isLeave = s.shiftType !== 'WORK'
    // Canviで登録されたシフトは濃い色、Googleカレンダー取込分(googleEventId有)は同色の透過
    const isFromGoogle = !!s.googleEventId
    const bgColor = isPending
      ? 'rgba(156, 163, 175, 0.25)' // gray-400 15%
      : isLeave
      ? SHIFT_TYPE_COLORS[s.shiftType] || '#6366f1'
      : isFromGoogle
      ? getStaffColorTransparent(s.staffId)
      : getStaffColor(s.staffId)
    const borderColor = isPending
      ? '#6b7280'
      : isFromGoogle
      ? getStaffColor(s.staffId)
      : bgColor
    const textColor = isPending || isFromGoogle ? '#1f2937' : '#fff'

    return {
      id: s.id,
      title: isPending
        ? `【PJ未割当】${s.notes || 'GCal'}`
        : isLeave
        ? `${s.staffName} - 欠勤`
        : `${s.staffName} - ${s.projectName}`,
      start: `${s.date}T${s.startTime}:00`,
      end: `${s.date}T${s.endTime}:00`,
      backgroundColor: bgColor,
      borderColor,
      textColor,
      classNames: isPending ? ['gcal-pending-event'] : [],
      extendedProps: {
        shift: s,
        statusColor: STATUS_COLORS[s.status] || '#9ca3af',
        isGoogleEvent: false,
        isPending,
      },
      // 仮想招待行 / pending は編集不可
      editable: !s.isVirtualAttendee && !isPending,
      durationEditable: !s.isVirtualAttendee && !isPending,
      startEditable: !s.isVirtualAttendee && !isPending,
      overlap: true,
    }
  })
}

function toGoogleCalendarFCEvents(events: GoogleCalendarEvent[]) {
  return events.map((e) => ({
    id: `gcal-${e.id}`,
    title: e.summary || '(予定)',
    start: e.start,
    end: e.end,
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
    borderColor: '#4285f4',
    textColor: '#1a73e8',
    editable: true,
    extendedProps: {
      isGoogleEvent: true,
      gcalEvent: e,
      summary: e.summary,
      description: e.description,
      location: e.location,
    },
  }))
}

function renderEventContent(eventInfo: EventContentArg) {
  const isGoogleEvent = eventInfo.event.extendedProps.isGoogleEvent

  if (isGoogleEvent) {
    const summary = eventInfo.event.extendedProps.summary as string || '(予定)'
    const startStr = eventInfo.event.start ? formatTime(eventInfo.event.start) : ''
    const endStr = eventInfo.event.end ? formatTime(eventInfo.event.end) : ''
    const hasMeet = !!eventInfo.event.extendedProps.gcalEvent?.meetUrl
    return (
      <div className="flex flex-col h-full p-0.5 overflow-hidden cursor-pointer">
        <div className="text-[10px] text-blue-500 flex items-center gap-0.5">
          {startStr}-{endStr}
          {hasMeet && <span title="Google Meet">📹</span>}
        </div>
        <div className="text-[10px] font-medium text-blue-700 truncate">{summary}</div>
      </div>
    )
  }

  const shift = eventInfo.event.extendedProps.shift as CalendarShift
  const statusColor = eventInfo.event.extendedProps.statusColor as string

  return (
    <div className="flex flex-col h-full p-0.5 overflow-hidden">
      <div className="flex items-center gap-0.5">
        <span
          className="shift-status-dot"
          style={{ backgroundColor: statusColor }}
        />
        <span className="text-[10px] opacity-80">
          {shift.startTime}-{shift.endTime}
        </span>
        {shift.googleMeetUrl && <span className="text-[10px]" title="Google Meet">📹</span>}
      </div>
      <div className="text-[11px] font-medium truncate">{shift.staffName}</div>
      <div className="text-[10px] opacity-75 truncate">{shift.projectName}</div>
    </div>
  )
}

export function ShiftFullCalendar({
  shifts,
  googleEvents = [],
  isManager,
  currentStaffId,
  onShiftClick,
  onShiftDragUpdate,
  onShiftCopy,
  onShiftDelete,
  onSlotSelect,
  onDateRangeChange,
  onGoogleEventClick,
  onGoogleEventDragUpdate,
}: ShiftFullCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [viewType, setViewType] = useState<'timeGridWeek' | 'timeGridDay' | 'dayGridMonth'>('timeGridWeek')
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    shiftId: string
    shiftDate: string
  } | null>(null)

  const shiftEvents = toFullCalendarEvents(shifts)
  const gcalEvents = toGoogleCalendarFCEvents(googleEvents)
  const events = [...shiftEvents, ...gcalEvents]

  // イベントドラッグ完了（移動）
  const handleEventDrop = useCallback(async (info: EventDropArg) => {
    if (info.event.extendedProps.isGoogleEvent) {
      if (!onGoogleEventDragUpdate) { info.revert(); return }
      const newStart = info.event.start!
      const newEnd = info.event.end!
      const startDateTime = toISOWithTZ(newStart)
      const endDateTime = toISOWithTZ(newEnd)
      const gcalEvent = info.event.extendedProps.gcalEvent as GoogleCalendarEvent
      const success = await onGoogleEventDragUpdate(gcalEvent.id, startDateTime, endDateTime)
      if (!success) info.revert()
      return
    }
    const shift = info.event.extendedProps.shift as CalendarShift

    // 自分のシフトは常に編集可能。他人のAPPROVEDは管理者のみ。
    const isOwnShift = !!currentStaffId && shift.staffId === currentStaffId
    if (!isManager && !isOwnShift && shift.status === 'APPROVED') {
      info.revert()
      toast.error('承認済みシフトは管理者のみ変更できます')
      return
    }

    const newStart = info.event.start!
    const newEnd = info.event.end!
    const date = formatDate(newStart)
    const startTime = formatTime(newStart)
    const endTime = formatTime(newEnd)

    const success = await onShiftDragUpdate(shift.id, date, startTime, endTime)
    if (!success) {
      info.revert()
    }
  }, [isManager, currentStaffId, onShiftDragUpdate, onGoogleEventDragUpdate])

  // イベントリサイズ完了
  const handleEventResize = useCallback(async (info: EventResizeDoneArg) => {
    if (info.event.extendedProps.isGoogleEvent) {
      if (!onGoogleEventDragUpdate) { info.revert(); return }
      const newStart = info.event.start!
      const newEnd = info.event.end!
      const startDateTime = toISOWithTZ(newStart)
      const endDateTime = toISOWithTZ(newEnd)
      const gcalEvent = info.event.extendedProps.gcalEvent as GoogleCalendarEvent
      const success = await onGoogleEventDragUpdate(gcalEvent.id, startDateTime, endDateTime)
      if (!success) info.revert()
      return
    }
    const shift = info.event.extendedProps.shift as CalendarShift

    // 自分のシフトは常に編集可能。他人のAPPROVEDは管理者のみ。
    const isOwnShift = !!currentStaffId && shift.staffId === currentStaffId
    if (!isManager && !isOwnShift && shift.status === 'APPROVED') {
      info.revert()
      toast.error('承認済みシフトは管理者のみ変更できます')
      return
    }

    const newStart = info.event.start!
    const newEnd = info.event.end!
    const date = formatDate(newStart)
    const startTime = formatTime(newStart)
    const endTime = formatTime(newEnd)

    const success = await onShiftDragUpdate(shift.id, date, startTime, endTime)
    if (!success) {
      info.revert()
    }
  }, [isManager, currentStaffId, onShiftDragUpdate, onGoogleEventDragUpdate])

  // イベントクリック
  const handleEventClick = useCallback((info: { event: EventApi; jsEvent: MouseEvent }) => {
    // 右クリック → コンテキストメニュー
    if (info.jsEvent.button === 2) return

    if (info.event.extendedProps.isGoogleEvent) {
      const gcalEvent = info.event.extendedProps.gcalEvent as GoogleCalendarEvent
      onGoogleEventClick?.(gcalEvent)
      return
    }

    const shift = info.event.extendedProps.shift as CalendarShift
    onShiftClick(shift)
  }, [onShiftClick, onGoogleEventClick])

  // 右クリック
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const handler = (e: MouseEvent) => {
      const eventEl = (e.target as HTMLElement).closest('.fc-event')
      if (!eventEl) return

      e.preventDefault()

      // テキスト内容からイベントを特定
      const fcEvent = calendarRef.current?.getApi().getEvents().find(ev => {
        const shift = ev.extendedProps.shift as CalendarShift
        return shift && eventEl.textContent?.includes(shift.staffName)
      })

      if (fcEvent) {
        const shift = fcEvent.extendedProps.shift as CalendarShift
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          shiftId: shift.id,
          shiftDate: shift.date,
        })
      }
    }

    el.addEventListener('contextmenu', handler)
    return () => el.removeEventListener('contextmenu', handler)
  }, [shifts])

  // コンテキストメニューアクション
  const handleContextAction = useCallback((action: ContextMenuAction, shiftId: string, targetDate?: string) => {
    setContextMenu(null)
    if (action === 'copy-next-day' || action === 'copy-next-week' || action === 'copy-to-date') {
      onShiftCopy(shiftId, targetDate || '')
    } else if (action === 'delete') {
      onShiftDelete(shiftId)
    } else if (action === 'edit') {
      const shift = shifts.find(s => s.id === shiftId)
      if (shift) onShiftClick(shift)
    }
  }, [shifts, onShiftCopy, onShiftDelete, onShiftClick])

  // 空スロットドラッグ選択（長押し→伸縮→離すで作成ダイアログ）
  const handleSelect = useCallback((info: DateSelectArg) => {
    const date = formatDate(info.start)
    const startTime = formatTime(info.start)
    const endTime = formatTime(info.end)
    onSlotSelect(date, startTime, endTime)
  }, [onSlotSelect])

  // 単純クリック（ドラッグなし）→ 60分デフォルトで作成ダイアログ
  const handleDateClick = useCallback((info: DateClickArg) => {
    // 月ビューでは日単位クリックなので 09:00-18:00 をデフォルトに
    if (info.view.type === 'dayGridMonth') {
      const date = formatDate(info.date)
      onSlotSelect(date, '09:00', '18:00')
      return
    }
    // 週/日ビューでは クリックしたスロットから60分
    const start = info.date
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    onSlotSelect(formatDate(start), formatTime(start), formatTime(end))
  }, [onSlotSelect])

  // 表示範囲変更
  const handleDatesSet = useCallback((dateInfo: DatesSetArg) => {
    const start = formatDate(dateInfo.start)
    const end = formatDate(dateInfo.end)
    onDateRangeChange(start, end)
    setViewType(dateInfo.view.type as typeof viewType)
  }, [onDateRangeChange])

  // ビュー切り替え
  const changeView = useCallback((view: 'timeGridWeek' | 'timeGridDay' | 'dayGridMonth') => {
    calendarRef.current?.getApi().changeView(view)
    setViewType(view)
  }, [])

  // 前後ナビ
  const goToday = useCallback(() => calendarRef.current?.getApi().today(), [])
  const goPrev = useCallback(() => calendarRef.current?.getApi().prev(), [])
  const goNext = useCallback(() => calendarRef.current?.getApi().next(), [])

  // 現在のタイトル取得
  const getTitle = useCallback(() => {
    return calendarRef.current?.getApi().view.title || ''
  }, [])

  const [title, setTitle] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setTitle(getTitle()), 50)
    return () => clearTimeout(t)
  }, [viewType, getTitle])

  // datesSetでもタイトル更新
  const handleDatesSetWithTitle = useCallback((dateInfo: DatesSetArg) => {
    handleDatesSet(dateInfo)
    setTimeout(() => setTitle(calendarRef.current?.getApi().view.title || ''), 10)
  }, [handleDatesSet])

  return (
    <div>
      {/* Custom toolbar */}
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
            ['dayGridMonth', '月'],
            ['timeGridWeek', '週'],
            ['timeGridDay', '日'],
          ] as const).map(([view, label]) => (
            <button
              key={view}
              onClick={() => changeView(view as typeof viewType)}
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

      {/* Calendar */}
      <div ref={wrapperRef} className="border rounded-lg overflow-hidden bg-background">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale="ja"
          firstDay={1}
          dayHeaderClassNames={(arg) => {
            const day = arg.date.getDay()
            const ymd = formatDate(arg.date)
            if (day === 0 || isJpHoliday(ymd)) return ['fc-day-jp-holiday']
            if (day === 6) return ['fc-day-jp-saturday']
            return []
          }}
          dayCellClassNames={(arg) => {
            const day = arg.date.getDay()
            const ymd = formatDate(arg.date)
            if (day === 0 || isJpHoliday(ymd)) return ['fc-day-jp-holiday']
            if (day === 6) return ['fc-day-jp-saturday']
            return []
          }}
          headerToolbar={false}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="23:00:00"
          slotDuration="00:30:00"
          slotLabelInterval="00:30:00"
          allDaySlot={true}
          allDayText="終日"
          nowIndicator={true}
          selectable={true}
          selectMirror={true}
          selectMinDistance={3}
          selectOverlap={true}
          unselectAuto={true}
          dateClick={handleDateClick}
          editable={true}
          eventResizableFromStart={false}
          snapDuration="00:15:00"
          events={events}
          eventContent={renderEventContent}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventClick={handleEventClick}
          select={handleSelect}
          datesSet={handleDatesSetWithTitle}
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
          views={{
            dayGridMonth: {
              dayHeaderFormat: { weekday: 'short' },
            },
          }}
          buttonText={{
            today: '今日',
            month: '月',
            week: '週',
            day: '日',
          }}
        />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ShiftContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          shiftId={contextMenu.shiftId}
          shiftDate={contextMenu.shiftDate}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

// --- Helpers ---

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function toISOWithTZ(d: Date): string {
  const date = formatDate(d)
  const time = formatTime(d)
  return `${date}T${time}:00+09:00`
}
