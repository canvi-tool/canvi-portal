'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Tables } from '@/lib/types/database'
import type { ShiftFormValues, ShiftQueryParams } from '@/lib/validations/shift'

// ---- Types ----

export type Shift = Tables<'shifts'> & {
  staff?: Tables<'staff'> | null
  project?: Tables<'projects'> | null
}

export interface ShiftWithRelations extends Shift {
  staff_name?: string
  project_name?: string
  actual_hours?: number
  approval_history?: Tables<'shift_approval_history'>[]
}

export interface SyncResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

// ---- Fetchers ----

async function fetchShifts(params?: ShiftQueryParams): Promise<ShiftWithRelations[]> {
  const searchParams = new URLSearchParams()
  if (params?.start_date) searchParams.set('start_date', params.start_date)
  if (params?.end_date) searchParams.set('end_date', params.end_date)
  if (params?.staff_id) searchParams.set('staff_id', params.staff_id)
  if (params?.project_id) searchParams.set('project_id', params.project_id)
  if (params?.status) searchParams.set('status', params.status)
  const res = await fetch(`/api/shifts?${searchParams.toString()}`)
  if (!res.ok) throw new Error('シフトの取得に失敗しました')
  return res.json()
}

async function fetchShift(id: string): Promise<ShiftWithRelations> {
  const res = await fetch(`/api/shifts/${id}`)
  if (!res.ok) throw new Error('シフトの取得に失敗しました')
  return res.json()
}

async function fetchPendingShifts(): Promise<ShiftWithRelations[]> {
  const res = await fetch('/api/shifts?status=SUBMITTED')
  if (!res.ok) throw new Error('承認待ちシフトの取得に失敗しました')
  return res.json()
}

async function createShift(data: ShiftFormValues): Promise<Shift> {
  const res = await fetch('/api/shifts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'シフトの作成に失敗しました')
  }
  return res.json()
}

async function updateShift(id: string, data: ShiftFormValues): Promise<Shift> {
  const res = await fetch(`/api/shifts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'シフトの更新に失敗しました')
  }
  return res.json()
}

async function deleteShift(id: string): Promise<void> {
  const res = await fetch(`/api/shifts/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('シフトの削除に失敗しました')
}

async function submitShift(id: string): Promise<Shift> {
  const res = await fetch(`/api/shifts/${id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'シフトの申請に失敗しました')
  }
  return res.json()
}

async function approveShift({ id, comment }: { id: string; comment?: string }): Promise<Shift> {
  const res = await fetch(`/api/shifts/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'APPROVE', comment }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'シフトの承認に失敗しました')
  }
  return res.json()
}

async function rejectShift({ id, comment }: { id: string; comment?: string }): Promise<Shift> {
  const res = await fetch(`/api/shifts/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'REJECT', comment }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'シフトの却下に失敗しました')
  }
  return res.json()
}

async function requestRevision({ id, comment, new_start_time, new_end_time }: {
  id: string
  comment?: string
  new_start_time?: string
  new_end_time?: string
}): Promise<Shift> {
  const res = await fetch(`/api/shifts/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'NEEDS_REVISION', comment, new_start_time, new_end_time }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '修正依頼に失敗しました')
  }
  return res.json()
}

async function triggerSync(params: {
  calendar_id: string
  project_id: string
  staff_id: string
  start_date: string
  end_date: string
}): Promise<SyncResult> {
  const res = await fetch('/api/shifts/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '同期に失敗しました')
  }
  return res.json()
}

// ---- Query Keys ----

export const shiftKeys = {
  all: ['shifts'] as const,
  lists: () => [...shiftKeys.all, 'list'] as const,
  list: (params?: ShiftQueryParams) => [...shiftKeys.lists(), params] as const,
  details: () => [...shiftKeys.all, 'detail'] as const,
  detail: (id: string) => [...shiftKeys.details(), id] as const,
  pending: () => [...shiftKeys.all, 'pending'] as const,
  sync: () => [...shiftKeys.all, 'sync'] as const,
}

// ---- Hooks ----

export function useShifts(params?: ShiftQueryParams) {
  return useQuery({
    queryKey: shiftKeys.list(params),
    queryFn: () => fetchShifts(params),
  })
}

export function useShift(id: string) {
  return useQuery({
    queryKey: shiftKeys.detail(id),
    queryFn: () => fetchShift(id),
    enabled: !!id,
  })
}

export function usePendingShifts() {
  return useQuery({
    queryKey: shiftKeys.pending(),
    queryFn: fetchPendingShifts,
  })
}

export function useCreateShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.lists() })
    },
  })
}

export function useUpdateShift(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ShiftFormValues) => updateShift(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.lists() })
      queryClient.invalidateQueries({ queryKey: shiftKeys.detail(id) })
    },
  })
}

export function useDeleteShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.lists() })
    },
  })
}

export function useSubmitShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: submitShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.lists() })
      queryClient.invalidateQueries({ queryKey: shiftKeys.pending() })
    },
  })
}

export function useApproveShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: approveShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.lists() })
      queryClient.invalidateQueries({ queryKey: shiftKeys.pending() })
    },
  })
}

export function useRejectShift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rejectShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.lists() })
      queryClient.invalidateQueries({ queryKey: shiftKeys.pending() })
    },
  })
}

export function useRequestRevision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: requestRevision,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.lists() })
      queryClient.invalidateQueries({ queryKey: shiftKeys.pending() })
    },
  })
}

export function useSyncShifts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: triggerSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.lists() })
    },
  })
}
