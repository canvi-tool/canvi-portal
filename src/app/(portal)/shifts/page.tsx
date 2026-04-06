'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  Plus,
  RefreshCw,
  ChevronDown,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { PageHeader } from '@/components/layout/page-header'
import { ShiftFullCalendar, type CalendarShift, type GoogleCalendarEvent } from './_components/shift-fullcalendar'
import { ShiftCreateDialog } from './_components/shift-create-dialog'
import { ShiftBulkDialog } from './_components/shift-bulk-dialog'
import { ShiftEditDialog } from './_components/shift-edit-dialog'
import { GCalEventDialog, type GCalEventItem } from './_components/gcal-event-dialog'
import { toast } from 'sonner'

// --- Types ---

interface ProjectOption {
  id: string
  name: string
  shiftApprovalMode: 'AUTO' | 'APPROVAL'
}

interface StaffOption {
  id: string
  name: string
  userId?: string
}

// --- Component ---

export default function ShiftsPage() {
  const router = useRouter()

  // Data
  const [shifts, setShifts] = useState<CalendarShift[]>([])
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [staffList, setStaffList] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterStaffIds, setFilterStaffIds] = useState<string[]>([]) // empty = all
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Date range from FullCalendar
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createInitial, setCreateInitial] = useState({ date: '', startTime: '', endTime: '' })
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)

  // Edit dialog
  const [editingShift, setEditingShift] = useState<{
    id: string; staffId: string; staffName: string; projectId: string;
    projectName: string; date: string; startTime: string; endTime: string;
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';
    notes?: string;
    googleMeetUrl?: string | null;
  } | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // GCal event dialog
  const [gcalEvent, setGcalEvent] = useState<GCalEventItem | null>(null)
  const [gcalDialogOpen, setGcalDialogOpen] = useState(false)

  const [isManager, setIsManager] = useState(false)
  const [currentStaffId, setCurrentStaffId] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/user/current')
      .then(r => r.json())
      .then(data => {
        if (data.isManager != null) setIsManager(data.isManager)
        if (data.staffId) setCurrentStaffId(data.staffId)
        if (data.roles) setUserRoles(data.roles)
        if (data.id) setCurrentUserId(data.id)
      })
      .catch(() => {})
  }, [])

  // GCal→Canvi オンデマンド同期（refで最新のfetchShifts/refreshGoogleEventsを参照）
  const syncFromGcalRef = useRef<(silent: boolean) => Promise<void>>(async () => {})
  const syncFromGcal = useCallback(async (silent = false) => {
    await syncFromGcalRef.current(silent)
  }, [])
  syncFromGcalRef.current = async (silent: boolean) => {
    if (!dateRange.start || !dateRange.end) return
    setSyncing(true)
    try {
      const res = await fetch('/api/shifts/sync-from-gcal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: dateRange.start, end_date: dateRange.end }),
      })
      if (res.ok) {
        const data = await res.json()
        const changes = data.created + data.updated + data.deleted
        if (changes > 0) {
          toast.success(data.message)
        } else if (!silent) {
          toast.info('Googleカレンダーとの差分はありません')
        }
        // 常にシフトとGCalイベントの両方を再取得
        fetchShifts()
        refreshGoogleEvents()
        setLastSynced(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }))
      } else if (!silent) {
        const err = await res.json().catch(() => ({}))
        if (err.error !== 'Googleカレンダーが未連携です') {
          toast.error(err.error || '同期に失敗しました')
        }
      }
    } catch {
      if (!silent) toast.error('同期に失敗しました')
    } finally {
      setSyncing(false)
    }
  }

  // シフトデータ取得
  const fetchShiftsRef = useRef<() => Promise<void>>(async () => {})
  const fetchShifts = useCallback(async () => {
    await fetchShiftsRef.current()
  }, [])
  const fetchShiftsImpl = useCallback(async () => {
    if (!dateRange.start || !dateRange.end) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
      })
      if (filterProject !== 'all') params.set('project_id', filterProject)
      if (filterStaffIds.length > 0) params.set('staff_id', filterStaffIds.join(','))
      if (filterStatus !== 'all') params.set('status', filterStatus)

      const res = await fetch(`/api/shifts?${params}`)
      if (!res.ok) throw new Error('シフトの取得に失敗しました')

      const data = await res.json()
      const list = data.data || (Array.isArray(data) ? data : [])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: CalendarShift[] = list.map((s: any) => {
        const staff = s.staff || {}
        const project = s.project || {}
        return {
          id: s.id,
          staffId: s.staff_id,
          staffName: `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明',
          projectId: s.project_id || '',
          projectName: project.name || '未割当',
          date: s.shift_date,
          startTime: (s.start_time || '').slice(0, 5),
          endTime: (s.end_time || '').slice(0, 5),
          status: s.status,
          shiftType: s.shift_type || 'WORK',
          notes: s.notes,
          googleMeetUrl: s.google_meet_url,
          googleEventId: s.google_calendar_event_id,
          approvalMode: project.shift_approval_mode || 'AUTO',
        }
      })

      setShifts(mapped)
    } catch {
      toast.error('シフトの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [dateRange, filterProject, filterStaffIds, filterStatus])

  // 最新のfetchShiftsImplをrefに同期（stale closure対策）
  useEffect(() => {
    fetchShiftsRef.current = fetchShiftsImpl
  }, [fetchShiftsImpl])

  // プロジェクトとスタッフ一覧を取得
  useEffect(() => {
    fetch('/api/projects?limit=100')
      .then(r => r.json())
      .then(res => {
        const list = res.data || (Array.isArray(res) ? res : [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProjects(list.map((p: any) => ({
          id: p.id,
          name: p.name,
          shiftApprovalMode: p.shift_approval_mode || 'AUTO',
        })))
      })
      .catch(() => {})

    fetch('/api/staff?status=active&limit=100')
      .then(r => r.json())
      .then(res => {
        const list = res.data || (Array.isArray(res) ? res : [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setStaffList(list.map((s: any) => ({
          id: s.id,
          name: `${s.last_name || ''} ${s.first_name || ''}`.trim(),
          userId: s.user_id || undefined,
        })))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchShiftsImpl()
  }, [fetchShiftsImpl])

  // ページ表示時にGCal→Canvi自動同期（サイレント）
  useEffect(() => {
    if (dateRange.start && dateRange.end && currentUserId) {
      syncFromGcal(true)
    }
  }, [dateRange.start, dateRange.end, currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  // フィルター対象のGCalユーザーIDを算出（複数選択時は自分のみ表示）
  const gcalTargetUserId = useMemo(() => {
    if (filterStaffIds.length === 0) return currentUserId
    if (filterStaffIds.length === 1) {
      const staff = staffList.find(s => s.id === filterStaffIds[0])
      return staff?.userId || currentUserId
    }
    return currentUserId // 複数選択時は自分のGCal
  }, [filterStaffIds, staffList, currentUserId])

  // Googleカレンダー予定取得
  useEffect(() => {
    if (!gcalTargetUserId || !dateRange.start || !dateRange.end) {
      setGoogleEvents([])
      return
    }
    const timeMin = `${dateRange.start}T00:00:00+09:00`
    const timeMax = `${dateRange.end}T23:59:59+09:00`
    const params = new URLSearchParams({ user_ids: gcalTargetUserId, time_min: timeMin, time_max: timeMax })
    fetch(`/api/calendar/availability?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.members?.length) { setGoogleEvents([]); return }
        const member = data.members[0]
        const gcEvents: GoogleCalendarEvent[] = (member.busy || [])
          .filter((b: { source: string }) => b.source === 'google')
          .map((b: { start: string; end: string; summary?: string; eventId?: string; description?: string; location?: string; meetUrl?: string }) => ({
            id: b.eventId || `gcal-${b.start}`,
            summary: b.summary || '(予定)',
            start: b.start,
            end: b.end,
            description: b.description,
            location: b.location,
            meetUrl: b.meetUrl || null,
          }))
        setGoogleEvents(gcEvents)
      })
      .catch(() => setGoogleEvents([]))
  }, [gcalTargetUserId, dateRange.start, dateRange.end])

  // FullCalendar handlers

  const handleDateRangeChange = useCallback((start: string, end: string) => {
    setDateRange({ start, end })
  }, [])

  const handleShiftClick = useCallback((shift: CalendarShift) => {
    setEditingShift({
      id: shift.id,
      staffId: shift.staffId,
      staffName: shift.staffName,
      projectId: shift.projectId,
      projectName: shift.projectName,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      status: shift.status,
      notes: shift.notes,
      googleMeetUrl: shift.googleMeetUrl,
    })
    setEditDialogOpen(true)
  }, [])

  const handleShiftDragUpdate = useCallback(async (
    shiftId: string, date: string, startTime: string, endTime: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_date: date,
          start_time: startTime,
          end_time: endTime,
          _dragUpdate: true,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'シフトの更新に失敗しました')
        return false
      }
      toast.success('シフトを移動しました')
      fetchShifts()
      return true
    } catch {
      toast.error('シフトの更新に失敗しました')
      return false
    }
  }, [fetchShifts])

  const handleShiftCopy = useCallback(async (shiftId: string, targetDate: string) => {
    const source = shifts.find(s => s.id === shiftId)
    if (!source || !targetDate) return

    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: source.staffId,
          project_id: source.projectId,
          shift_date: targetDate,
          start_time: source.startTime,
          end_time: source.endTime,
          shift_type: source.shiftType,
          notes: source.notes,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${targetDate} にシフトをコピーしました`)
      fetchShifts()
    } catch {
      toast.error('シフトのコピーに失敗しました')
    }
  }, [shifts, fetchShifts])

  const handleShiftDelete = useCallback(async (shiftId: string) => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('シフトを削除しました')
        fetchShifts()
      } else {
        toast.error('シフトの削除に失敗しました')
      }
    } catch {
      toast.error('シフトの削除に失敗しました')
    }
  }, [fetchShifts])

  const handleSlotSelect = useCallback((date: string, startTime: string, endTime: string) => {
    setCreateInitial({ date, startTime, endTime })
    setCreateDialogOpen(true)
  }, [])

  const handleShiftSave = useCallback(async (updated: { id: string; staffName: string; startTime: string; endTime: string; projectId?: string; notes?: string }) => {
    try {
      const body: Record<string, unknown> = {
        start_time: updated.startTime,
        end_time: updated.endTime,
        _inlineUpdate: true,
      }
      if (updated.projectId) body.project_id = updated.projectId
      if (updated.notes !== undefined) body.notes = updated.notes

      const res = await fetch(`/api/shifts/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success(`${updated.staffName}のシフトを更新しました`)
        fetchShifts()
      } else {
        toast.error('シフトの更新に失敗しました')
      }
    } catch {
      toast.error('シフトの更新に失敗しました')
    }
  }, [fetchShifts])

  const handleShiftApprove = useCallback(async (shiftId: string) => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      })
      if (res.ok) {
        toast.success('シフトを承認しました')
        fetchShifts()
      }
    } catch {
      toast.error('シフトの承認に失敗しました')
    }
  }, [fetchShifts])

  const handleShiftReject = useCallback(async (shiftId: string) => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT' }),
      })
      if (res.ok) {
        toast.success('シフトを却下しました')
        fetchShifts()
      }
    } catch {
      toast.error('シフトの却下に失敗しました')
    }
  }, [fetchShifts])

  // --- Google Calendar event handlers ---

  const handleGoogleEventClick = useCallback((event: GoogleCalendarEvent) => {
    setGcalEvent({
      id: event.id,
      summary: event.summary,
      start: event.start,
      end: event.end,
      description: event.description,
      location: event.location,
      meetUrl: event.meetUrl,
    })
    setGcalDialogOpen(true)
  }, [])

  const handleGoogleEventDragUpdate = useCallback(async (
    eventId: string, startDateTime: string, endDateTime: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/gcal-events/${encodeURIComponent(eventId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDateTime, endDateTime }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Googleカレンダーの更新に失敗しました')
        return false
      }
      toast.success('Googleカレンダーの予定を移動しました')
      // GCal予定を再取得
      refreshGoogleEvents()
      return true
    } catch {
      toast.error('Googleカレンダーの更新に失敗しました')
      return false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGcalEventTimeUpdate = useCallback(async (
    eventId: string, startDateTime: string, endDateTime: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/gcal-events/${encodeURIComponent(eventId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDateTime, endDateTime }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Googleカレンダーの更新に失敗しました')
        return false
      }
      toast.success('Googleカレンダーの予定を更新しました')
      refreshGoogleEvents()
      return true
    } catch {
      toast.error('Googleカレンダーの更新に失敗しました')
      return false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGcalEventDelete = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/gcal-events/${encodeURIComponent(eventId)}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Googleカレンダーの予定を削除しました')
        refreshGoogleEvents()
      } else {
        toast.error('Googleカレンダーの予定の削除に失敗しました')
      }
    } catch {
      toast.error('Googleカレンダーの予定の削除に失敗しました')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGcalMeetCreate = useCallback(async (eventId: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/gcal-events/${encodeURIComponent(eventId)}/meet`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Meet URLの発行に失敗しました')
        return null
      }
      const data = await res.json()
      toast.success('Google Meet URLを発行しました')
      refreshGoogleEvents()
      return data.meetUrl
    } catch {
      toast.error('Meet URLの発行に失敗しました')
      return null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGcalMeetDelete = useCallback(async (eventId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/gcal-events/${encodeURIComponent(eventId)}/meet`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Meet URLの削除に失敗しました')
        return false
      }
      toast.success('Google Meet URLを削除しました')
      refreshGoogleEvents()
      return true
    } catch {
      toast.error('Meet URLの削除に失敗しました')
      return false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // GCal予定を再取得するヘルパー（refで最新状態を参照）
  const refreshGoogleEventsRef = useRef<() => void>(() => {})
  const refreshGoogleEvents = useCallback(() => {
    refreshGoogleEventsRef.current()
  }, [])
  refreshGoogleEventsRef.current = () => {
    if (!gcalTargetUserId || !dateRange.start || !dateRange.end) return
    const timeMin = `${dateRange.start}T00:00:00+09:00`
    const timeMax = `${dateRange.end}T23:59:59+09:00`
    const params = new URLSearchParams({ user_ids: gcalTargetUserId, time_min: timeMin, time_max: timeMax })
    fetch(`/api/calendar/availability?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.members?.length) { setGoogleEvents([]); return }
        const member = data.members[0]
        const gcEvents: GoogleCalendarEvent[] = (member.busy || [])
          .filter((b: { source: string }) => b.source === 'google')
          .map((b: { start: string; end: string; summary?: string; eventId?: string; description?: string; location?: string; meetUrl?: string }) => ({
            id: b.eventId || `gcal-${b.start}`,
            summary: b.summary || '(予定)',
            start: b.start,
            end: b.end,
            description: b.description,
            location: b.location,
            meetUrl: b.meetUrl || null,
          }))
        setGoogleEvents(gcEvents)
      })
      .catch(() => {})
  }

  // Stats
  const totalShifts = shifts.length
  const pendingCount = shifts.filter(s => s.status === 'SUBMITTED').length
  const approvedCount = shifts.filter(s => s.status === 'APPROVED').length

  // 合計時間計算（スタッフ別）
  const staffHours = useMemo(() => {
    const map = new Map<string, { name: string; hours: number; shifts: number }>()
    let totalHours = 0

    for (const s of shifts) {
      if (s.shiftType !== 'WORK') continue
      const [sh, sm] = s.startTime.split(':').map(Number)
      const [eh, em] = s.endTime.split(':').map(Number)
      const hours = (eh * 60 + em - sh * 60 - sm) / 60
      if (hours <= 0) continue

      totalHours += hours
      const existing = map.get(s.staffId)
      if (existing) {
        existing.hours += hours
        existing.shifts += 1
      } else {
        map.set(s.staffId, { name: s.staffName, hours, shifts: 1 })
      }
    }

    const byStaff = Array.from(map.values()).sort((a, b) => b.hours - a.hours)
    return { byStaff, totalHours }
  }, [shifts])

  // シフト由来のGCalイベントを除外（重複表示防止: シフト管理側を優先表示）
  const dedupedGoogleEvents = useMemo(() => {
    const shiftEventIds = new Set(
      shifts.map(s => s.googleEventId).filter((v): v is string => !!v)
    )
    if (shiftEventIds.size === 0) return googleEvents
    return googleEvents.filter(e => !shiftEventIds.has(e.id))
  }, [googleEvents, shifts])

  // Filter labels
  const projectLabels = useMemo<Record<string, string>>(() => (
    { all: '全プロジェクト', ...Object.fromEntries(projects.map(p => [p.id, p.name])) }
  ), [projects])
const statusLabels = useMemo<Record<string, string>>(() => ({
    all: '全ステータス',
    DRAFT: '下書き',
    SUBMITTED: '申請中',
    APPROVED: '承認済',
    REJECTED: '却下',
    NEEDS_REVISION: '修正依頼',
  }), [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="シフト管理"
        description="ドラッグ&リサイズでシフトを直感的に管理"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncFromGcal(false)}
              disabled={syncing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? '同期中...' : 'GCal同期'}
              {lastSynced && <span className="ml-1 text-[10px] text-muted-foreground">{lastSynced}</span>}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const today = new Date()
                const y = today.getFullYear()
                const m = String(today.getMonth() + 1).padStart(2, '0')
                const d = String(today.getDate()).padStart(2, '0')
                setCreateInitial({ date: `${y}-${m}-${d}`, startTime: '09:00', endTime: '18:00' })
                setCreateDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              申請
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkDialogOpen(true)}
            >
              <CalendarPlus className="h-4 w-4 mr-1" />
              一括申請
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/shifts/pending')}
            >
              <Clock className="h-4 w-4 mr-1" />
              承認待ち
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 min-w-4 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
            </Button>
          </div>
        }
      />

      {/* Stats Bar */}
      <Card>
        <CardContent className="pt-0">
          <div className="flex items-center gap-6 flex-wrap">
            {/* 合計 */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-lg font-bold">{staffHours.totalHours.toFixed(1)}h</span>
              <span className="text-xs text-muted-foreground">合計</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{totalShifts}件</span>
            </div>
            {pendingCount > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-sm text-amber-600">{pendingCount}件待ち</span>
              </div>
            )}
            {approvedCount > 0 && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span className="text-sm text-green-600">{approvedCount}件承認</span>
              </div>
            )}

            {/* スタッフ別時間 */}
            {staffHours.byStaff.length > 0 && (
              <>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-3 flex-wrap">
                  {staffHours.byStaff.map((s) => (
                    <div key={s.name} className="flex items-center gap-1 text-xs">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-primary font-bold">{s.hours.toFixed(1)}h</span>
                      <span className="text-muted-foreground">({s.shifts}件)</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="h-9 w-auto min-w-[120px] text-sm">
            <SelectValueWithLabel value={filterProject} labels={projectLabels} placeholder="全PJ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全プロジェクト</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-auto min-w-[100px] text-sm">
            <SelectValueWithLabel value={filterStatus} labels={statusLabels} placeholder="全状態" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(statusLabels).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger
            className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border border-input bg-background px-3 h-9 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
          >
            <Users className="h-3.5 w-3.5" />
            {filterStaffIds.length === 0
              ? '全スタッフ'
              : filterStaffIds.length === 1
                ? staffList.find(s => s.id === filterStaffIds[0])?.name || '1名'
                : `${filterStaffIds.length}名選択`}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1 max-h-64 overflow-y-auto">
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-muted"
                onClick={() => setFilterStaffIds([])}
              >
                <Checkbox checked={filterStaffIds.length === 0} />
                全スタッフ
              </button>
              <div className="border-t my-1" />
              {staffList.map(s => (
                <button
                  key={s.id}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-muted"
                  onClick={() => {
                    setFilterStaffIds(prev =>
                      prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                    )
                  }}
                >
                  <Checkbox checked={filterStaffIds.includes(s.id)} />
                  {s.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {loading && (
          <span className="text-xs text-muted-foreground">読み込み中...</span>
        )}
      </div>

      {/* FullCalendar */}
      <ShiftFullCalendar
        shifts={shifts}
        googleEvents={filterProject === 'all' ? dedupedGoogleEvents : []}
        isManager={isManager}
        onShiftClick={handleShiftClick}
        onShiftDragUpdate={handleShiftDragUpdate}
        onShiftCopy={handleShiftCopy}
        onShiftDelete={handleShiftDelete}
        onSlotSelect={handleSlotSelect}
        onDateRangeChange={handleDateRangeChange}
        onGoogleEventClick={handleGoogleEventClick}
        onGoogleEventDragUpdate={handleGoogleEventDragUpdate}
      />

      {/* Create Dialog */}
      <ShiftCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        initialDate={createInitial.date}
        initialStartTime={createInitial.startTime}
        initialEndTime={createInitial.endTime}
        projects={projects}
        staffList={staffList}
        currentStaffId={currentStaffId}
        isManager={isManager}
        onCreated={fetchShifts}
      />

      {/* Bulk Dialog */}
      <ShiftBulkDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        projects={projects}
        staffList={staffList}
        currentStaffId={currentStaffId}
        isManager={isManager}
        userRoles={userRoles}
        onCreated={fetchShifts}
      />

      {/* Edit Dialog */}
      <ShiftEditDialog
        shift={editingShift}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleShiftSave}
        onDelete={handleShiftDelete}
        onApprove={handleShiftApprove}
        onReject={handleShiftReject}
        onSyncCalendar={() => fetchShifts()}
        isManager={isManager}
        projects={projects}
      />

      {/* GCal Event Dialog */}
      <GCalEventDialog
        event={gcalEvent}
        open={gcalDialogOpen}
        onOpenChange={setGcalDialogOpen}
        onTimeUpdate={handleGcalEventTimeUpdate}
        onDelete={handleGcalEventDelete}
        onMeetCreate={handleGcalMeetCreate}
        onMeetDelete={handleGcalMeetDelete}
      />
    </div>
  )
}
