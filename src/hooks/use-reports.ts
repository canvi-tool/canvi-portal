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
