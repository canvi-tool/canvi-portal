'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Tables } from '@/lib/types/database'
import type {
  WorkReportFormValues,
  WorkReportQueryParams,
  WorkReportApprovalValues,
  PerformanceReportFormValues,
  PerformanceReportQueryParams,
} from '@/lib/validations/report'

// ---- Types ----

export type WorkReport = Tables<'work_reports'> & {
  staff?: Tables<'staff'> | null
  project?: Tables<'projects'> | null
  qualitative_report?: string
  deliverable_url?: string
  count_data?: Record<string, number>
  approval_comment?: string
}

export type PerformanceReport = Tables<'performance_reports'> & {
  staff?: Tables<'staff'> | null
  project?: Tables<'projects'> | null
}

// ---- Work Report Fetchers ----

async function fetchWorkReports(params?: WorkReportQueryParams): Promise<WorkReport[]> {
  const searchParams = new URLSearchParams()
  if (params?.start_date) searchParams.set('start_date', params.start_date)
  if (params?.end_date) searchParams.set('end_date', params.end_date)
  if (params?.staff_id) searchParams.set('staff_id', params.staff_id)
  if (params?.project_id) searchParams.set('project_id', params.project_id)
  if (params?.status) searchParams.set('status', params.status)
  const res = await fetch(`/api/reports/work?${searchParams.toString()}`)
  if (!res.ok) throw new Error('勤務報告の取得に失敗しました')
  return res.json()
}

async function fetchWorkReport(id: string): Promise<WorkReport> {
  const res = await fetch(`/api/reports/work/${id}`)
  if (!res.ok) throw new Error('勤務報告の取得に失敗しました')
  return res.json()
}

async function createWorkReport(data: WorkReportFormValues): Promise<WorkReport> {
  const res = await fetch('/api/reports/work', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '勤務報告の作成に失敗しました')
  }
  return res.json()
}

async function updateWorkReport(id: string, data: WorkReportFormValues): Promise<WorkReport> {
  const res = await fetch(`/api/reports/work/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '勤務報告の更新に失敗しました')
  }
  return res.json()
}

async function approveWorkReport(
  id: string,
  data: WorkReportApprovalValues
): Promise<WorkReport> {
  const res = await fetch(`/api/reports/work/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '承認処理に失敗しました')
  }
  return res.json()
}

// ---- Performance Report Fetchers ----

async function fetchPerformanceReports(
  params?: PerformanceReportQueryParams
): Promise<PerformanceReport[]> {
  const searchParams = new URLSearchParams()
  if (params?.year_month) searchParams.set('year_month', params.year_month)
  if (params?.staff_id) searchParams.set('staff_id', params.staff_id)
  if (params?.project_id) searchParams.set('project_id', params.project_id)
  if (params?.status) searchParams.set('status', params.status)
  const res = await fetch(`/api/reports/performance?${searchParams.toString()}`)
  if (!res.ok) throw new Error('業務実績の取得に失敗しました')
  return res.json()
}

async function fetchPerformanceReport(id: string): Promise<PerformanceReport> {
  const res = await fetch(`/api/reports/performance/${id}`)
  if (!res.ok) throw new Error('業務実績の取得に失敗しました')
  return res.json()
}

async function generatePerformanceReport(
  data: PerformanceReportFormValues
): Promise<PerformanceReport> {
  const res = await fetch('/api/reports/performance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '業務実績の生成に失敗しました')
  }
  return res.json()
}

// ---- Query Keys ----

export const workReportKeys = {
  all: ['work-reports'] as const,
  lists: () => [...workReportKeys.all, 'list'] as const,
  list: (params?: WorkReportQueryParams) => [...workReportKeys.lists(), params] as const,
  details: () => [...workReportKeys.all, 'detail'] as const,
  detail: (id: string) => [...workReportKeys.details(), id] as const,
}

export const performanceReportKeys = {
  all: ['performance-reports'] as const,
  lists: () => [...performanceReportKeys.all, 'list'] as const,
  list: (params?: PerformanceReportQueryParams) =>
    [...performanceReportKeys.lists(), params] as const,
  details: () => [...performanceReportKeys.all, 'detail'] as const,
  detail: (id: string) => [...performanceReportKeys.details(), id] as const,
}

// ---- Work Report Hooks ----

export function useWorkReports(params?: WorkReportQueryParams) {
  return useQuery({
    queryKey: workReportKeys.list(params),
    queryFn: () => fetchWorkReports(params),
  })
}

export function useWorkReport(id: string) {
  return useQuery({
    queryKey: workReportKeys.detail(id),
    queryFn: () => fetchWorkReport(id),
    enabled: !!id,
  })
}

export function useCreateWorkReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createWorkReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workReportKeys.lists() })
    },
  })
}

export function useUpdateWorkReport(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: WorkReportFormValues) => updateWorkReport(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workReportKeys.lists() })
      queryClient.invalidateQueries({ queryKey: workReportKeys.detail(id) })
    },
  })
}

export function useApproveWorkReport(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: WorkReportApprovalValues) => approveWorkReport(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workReportKeys.lists() })
      queryClient.invalidateQueries({ queryKey: workReportKeys.detail(id) })
    },
  })
}

// ---- Performance Report Hooks ----

export function usePerformanceReports(params?: PerformanceReportQueryParams) {
  return useQuery({
    queryKey: performanceReportKeys.list(params),
    queryFn: () => fetchPerformanceReports(params),
  })
}

export function usePerformanceReport(id: string) {
  return useQuery({
    queryKey: performanceReportKeys.detail(id),
    queryFn: () => fetchPerformanceReport(id),
    enabled: !!id,
  })
}

export function useGeneratePerformanceReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: generatePerformanceReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: performanceReportKeys.lists() })
    },
  })
}
