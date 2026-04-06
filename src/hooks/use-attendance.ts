'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ClockInInput } from '@/lib/validations/attendance'

export interface AttendanceRecord {
  id: string
  user_id: string
  staff_id: string | null
  project_id: string | null
  date: string
  clock_in: string | null
  clock_out: string | null
  break_start: string | null
  break_end: string | null
  break_minutes: number
  work_minutes: number | null
  overtime_minutes: number
  status: 'clocked_in' | 'on_break' | 'clocked_out' | 'modified' | 'approved'
  location_type: string | null
  note: string | null
  modified_by: string | null
  modification_reason: string | null
  created_at: string
  updated_at: string
  staff?: { id: string; display_name: string } | null
  project?: { id: string; name: string; project_code: string } | null
}

export interface TodayStatus {
  /** 後方互換: アクティブまたは最新のレコード */
  record: AttendanceRecord | null
  status: string
  /** 今日の全打刻レコード（複数PJ対応） */
  records: AttendanceRecord[]
}

export interface MyProject {
  id: string
  name: string
  project_code: string
  status: string
  slack_channel_id: string | null
  slack_channel_name: string | null
}

// ---- Fetchers ----

async function fetchTodayStatus(): Promise<TodayStatus> {
  const res = await fetch('/api/attendance/today')
  if (!res.ok) throw new Error('打刻状態の取得に失敗しました')
  const data = await res.json()
  return {
    record: data.record || null,
    status: data.status || 'not_clocked_in',
    records: data.records || [],
  }
}

async function fetchMyProjects(): Promise<MyProject[]> {
  const res = await fetch('/api/my-projects')
  if (!res.ok) throw new Error('アサインプロジェクトの取得に失敗しました')
  return res.json()
}

async function fetchAttendanceRecords(params?: {
  staff_id?: string
  user_id?: string
  date_from?: string
  date_to?: string
  project_id?: string
  page?: number
  per_page?: number
}): Promise<{ data: AttendanceRecord[]; total: number }> {
  const searchParams = new URLSearchParams()
  if (params?.staff_id) searchParams.set('staff_id', params.staff_id)
  if (params?.user_id) searchParams.set('user_id', params.user_id)
  if (params?.date_from) searchParams.set('date_from', params.date_from)
  if (params?.date_to) searchParams.set('date_to', params.date_to)
  if (params?.project_id) searchParams.set('project_id', params.project_id)
  if (params?.page) searchParams.set('page', params.page.toString())
  if (params?.per_page) searchParams.set('per_page', params.per_page.toString())
  const res = await fetch(`/api/attendance?${searchParams.toString()}`)
  if (!res.ok) throw new Error('打刻一覧の取得に失敗しました')
  return res.json()
}

async function clockIn(data: ClockInInput): Promise<AttendanceRecord> {
  const res = await fetch('/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '出勤打刻に失敗しました')
  }
  return res.json()
}

async function clockOut(id: string): Promise<AttendanceRecord> {
  const res = await fetch(`/api/attendance/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'clock_out' }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '退勤打刻に失敗しました')
  }
  return res.json()
}

async function breakStart(id: string): Promise<AttendanceRecord> {
  const res = await fetch(`/api/attendance/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'break_start' }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '休憩開始に失敗しました')
  }
  return res.json()
}

async function breakEnd(id: string): Promise<AttendanceRecord> {
  const res = await fetch(`/api/attendance/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'break_end' }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '休憩終了に失敗しました')
  }
  return res.json()
}

// ---- Query Keys ----

export const attendanceKeys = {
  all: ['attendance'] as const,
  today: () => [...attendanceKeys.all, 'today'] as const,
  myProjects: () => [...attendanceKeys.all, 'my-projects'] as const,
  lists: () => [...attendanceKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...attendanceKeys.lists(), params] as const,
}

// ---- Hooks ----

export function useTodayAttendance() {
  return useQuery({
    queryKey: attendanceKeys.today(),
    queryFn: fetchTodayStatus,
    refetchInterval: 60000, // 1分ごとに更新
  })
}

/** 自分がアサインされているプロジェクト一覧 */
export function useMyProjects() {
  return useQuery({
    queryKey: attendanceKeys.myProjects(),
    queryFn: fetchMyProjects,
  })
}

export function useAttendanceRecords(params?: {
  staff_id?: string
  user_id?: string
  date_from?: string
  date_to?: string
  project_id?: string
  page?: number
  per_page?: number
}) {
  return useQuery({
    queryKey: attendanceKeys.list(params as Record<string, unknown>),
    queryFn: () => fetchAttendanceRecords(params),
  })
}

export function useClockIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: clockIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today() })
      queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() })
    },
  })
}

export function useClockOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: clockOut,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today() })
      queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() })
    },
  })
}

export function useBreakStart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: breakStart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today() })
    },
  })
}

export function useBreakEnd() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: breakEnd,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today() })
    },
  })
}

async function bulkBreak(action: 'break_start' | 'break_end'): Promise<{ count: number }> {
  const res = await fetch('/api/attendance/bulk-break', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '一括休憩操作に失敗しました')
  }
  return res.json()
}

export function useBulkBreakStart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => bulkBreak('break_start'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today() })
      queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() })
    },
  })
}

export function useBulkBreakEnd() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => bulkBreak('break_end'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today() })
      queryClient.invalidateQueries({ queryKey: attendanceKeys.lists() })
    },
  })
}
