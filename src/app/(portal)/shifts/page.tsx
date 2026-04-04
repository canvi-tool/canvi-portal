'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
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
import { PageHeader } from '@/components/layout/page-header'
import { ShiftFullCalendar, type CalendarShift } from './_components/shift-fullcalendar'
import { ShiftCreateDialog } from './_components/shift-create-dialog'
import { ShiftEditDialog } from './_components/shift-edit-dialog'
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
}

// --- Component ---

export default function ShiftsPage() {
  const router = useRouter()

  // Data
  const [shifts, setShifts] = useState<CalendarShift[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [staffList, setStaffList] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterStaff, setFilterStaff] = useState<string>('all')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Date range from FullCalendar
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createInitial, setCreateInitial] = useState({ date: '', startTime: '', endTime: '' })

  // Edit dialog
  const [editingShift, setEditingShift] = useState<{
    id: string; staffId: string; staffName: string; projectId: string;
    projectName: string; date: string; startTime: string; endTime: string;
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';
    notes?: string;
  } | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const [isManager, setIsManager] = useState(false)
  const [currentStaffId, setCurrentStaffId] = useState('')

  useEffect(() => {
    fetch('/api/user/current')
      .then(r => r.json())
      .then(data => {
        if (data.isManager != null) setIsManager(data.isManager)
        if (data.staffId) setCurrentStaffId(data.staffId)
      })
      .catch(() => {})
  }, [])

  // シフトデータ取得
  const fetchShifts = useCallback(async () => {
    if (!dateRange.start || !dateRange.end) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
      })
      if (filterProject !== 'all') params.set('project_id', filterProject)
      if (filterStaff !== 'all') params.set('staff_id', filterStaff)
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
          approvalMode: project.shift_approval_mode || 'AUTO',
        }
      })

      setShifts(mapped)
    } catch {
      toast.error('シフトの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [dateRange, filterProject, filterStaff, filterStatus])

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
        })))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchShifts()
  }, [fetchShifts])

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
          created_by: source.staffId,
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

  const handleShiftSave = useCallback(async (updated: { id: string; staffName: string; startTime: string; endTime: string }) => {
    try {
      const res = await fetch(`/api/shifts/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: updated.startTime,
          end_time: updated.endTime,
        }),
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

  // Stats
  const totalShifts = shifts.length
  const pendingCount = shifts.filter(s => s.status === 'SUBMITTED').length
  const approvedCount = shifts.filter(s => s.status === 'APPROVED').length

  // Filter labels
  const projectLabels = useMemo<Record<string, string>>(() => (
    { all: '全プロジェクト', ...Object.fromEntries(projects.map(p => [p.id, p.name])) }
  ), [projects])
  const staffLabels = useMemo<Record<string, string>>(() => (
    { all: '全スタッフ', ...Object.fromEntries(staffList.map(s => [s.id, s.name])) }
  ), [staffList])
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

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <CalendarDays className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{totalShifts}件</p>
              <p className="text-xs text-muted-foreground">総シフト数</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{pendingCount}件</p>
              <p className="text-xs text-muted-foreground">承認待ち</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{approvedCount}件</p>
              <p className="text-xs text-muted-foreground">承認済み</p>
            </div>
          </CardContent>
        </Card>
      </div>

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

        <Select value={filterStaff} onValueChange={setFilterStaff}>
          <SelectTrigger className="h-9 w-auto min-w-[100px] text-sm">
            <SelectValueWithLabel value={filterStaff} labels={staffLabels} placeholder="全員" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全スタッフ</SelectItem>
            {staffList.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {loading && (
          <span className="text-xs text-muted-foreground">読み込み中...</span>
        )}
      </div>

      {/* FullCalendar */}
      <ShiftFullCalendar
        shifts={shifts}
        isManager={isManager}
        onShiftClick={handleShiftClick}
        onShiftDragUpdate={handleShiftDragUpdate}
        onShiftCopy={handleShiftCopy}
        onShiftDelete={handleShiftDelete}
        onSlotSelect={handleSlotSelect}
        onDateRangeChange={handleDateRangeChange}
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

      {/* Edit Dialog */}
      <ShiftEditDialog
        shift={editingShift}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleShiftSave}
        onDelete={handleShiftDelete}
        onApprove={handleShiftApprove}
        onReject={handleShiftReject}
      />
    </div>
  )
}
