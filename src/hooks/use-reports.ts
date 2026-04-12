'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Tables } from '@/lib/types/database'
import type {
  PerformanceReportFormValues,
  PerformanceReportQueryParams,
} from '@/lib/validations/report'

// ---- Types ----

export type PerformanceReport = Tables<'performance_reports'> & {
  staff?: Tables<'staff'> | null
  project?: Tables<'projects'> | null
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

async function deletePerformanceReport(id: string): Promise<void> {
  const res = await fetch(`/api/reports/performance/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '月次報告の削除に失敗しました')
  }
}

async function approvePerformanceReport(id: string, data: { status: 'approved' | 'rejected'; comment?: string }): Promise<PerformanceReport> {
  const res = await fetch(`/api/reports/performance/${id}`, {
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

async function generatePerformanceReport(
  data: PerformanceReportFormValues & { asDraft?: boolean }
): Promise<PerformanceReport> {
  const { asDraft, ...payload } = data
  const qs = asDraft ? '?draft=1' : ''
  const res = await fetch(`/api/reports/performance${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '業務実績の生成に失敗しました')
  }
  return res.json()
}

// ---- Query Keys ----

export const performanceReportKeys = {
  all: ['performance-reports'] as const,
  lists: () => [...performanceReportKeys.all, 'list'] as const,
  list: (params?: PerformanceReportQueryParams) =>
    [...performanceReportKeys.lists(), params] as const,
  details: () => [...performanceReportKeys.all, 'detail'] as const,
  detail: (id: string) => [...performanceReportKeys.details(), id] as const,
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

export function useDeletePerformanceReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePerformanceReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: performanceReportKeys.lists() })
    },
  })
}

export function useApprovePerformanceReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: 'approved' | 'rejected'; comment?: string } }) =>
      approvePerformanceReport(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: performanceReportKeys.lists() })
    },
  })
}

