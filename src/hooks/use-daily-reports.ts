'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Tables } from '@/lib/types/database'
import type { DailyReportFormValues, DailyReportType } from '@/lib/validations/daily-report'
import type { WorkReportApprovalValues } from '@/lib/validations/report'

// Type
export type DailyReport = Tables<'work_reports'> & {
  staff?: { id: string; last_name: string; first_name: string } | null
  project?: { id: string; name: string } | null
  report_type: DailyReportType
  custom_fields: Record<string, unknown>
  staff_name?: string
  project_name?: string
}

// Query params
export interface DailyReportQueryParams {
  start_date?: string
  end_date?: string
  staff_id?: string
  project_id?: string
  status?: string
  report_type?: string
}

// Fetchers
async function fetchDailyReports(params?: DailyReportQueryParams): Promise<DailyReport[]> {
  const sp = new URLSearchParams()
  if (params?.start_date) sp.set('start_date', params.start_date)
  if (params?.end_date) sp.set('end_date', params.end_date)
  if (params?.staff_id) sp.set('staff_id', params.staff_id)
  if (params?.project_id) sp.set('project_id', params.project_id)
  if (params?.status) sp.set('status', params.status)
  if (params?.report_type) sp.set('report_type', params.report_type)
  const res = await fetch(`/api/reports/daily?${sp.toString()}`)
  if (!res.ok) throw new Error('日報の取得に失敗しました')
  return res.json()
}

async function fetchDailyReport(id: string): Promise<DailyReport> {
  const res = await fetch(`/api/reports/daily/${id}`)
  if (!res.ok) throw new Error('日報の取得に失敗しました')
  return res.json()
}

async function createDailyReport(data: DailyReportFormValues): Promise<DailyReport> {
  const res = await fetch('/api/reports/daily', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '日報の提出に失敗しました')
  }
  return res.json()
}

async function approveDailyReport(id: string, data: WorkReportApprovalValues): Promise<DailyReport> {
  const res = await fetch(`/api/reports/daily/${id}`, {
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

// Also add a function to fetch monthly KPI totals for a staff member
async function fetchMonthlyKpiTotals(staffId: string, projectId: string, yearMonth: string): Promise<{
  total_calls: number
  total_contacts: number
  total_appointments: number
  total_received: number
  total_completed: number
  total_escalations: number
  report_count: number
}> {
  const sp = new URLSearchParams({ staff_id: staffId, project_id: projectId, year_month: yearMonth })
  const res = await fetch(`/api/reports/daily/monthly-totals?${sp.toString()}`)
  if (!res.ok) return { total_calls: 0, total_contacts: 0, total_appointments: 0, total_received: 0, total_completed: 0, total_escalations: 0, report_count: 0 }
  return res.json()
}

// Query keys
export const dailyReportKeys = {
  all: ['daily-reports'] as const,
  lists: () => [...dailyReportKeys.all, 'list'] as const,
  list: (params?: DailyReportQueryParams) => [...dailyReportKeys.lists(), params] as const,
  details: () => [...dailyReportKeys.all, 'detail'] as const,
  detail: (id: string) => [...dailyReportKeys.details(), id] as const,
  monthlyTotals: (staffId: string, projectId: string, yearMonth: string) =>
    [...dailyReportKeys.all, 'monthly-totals', staffId, projectId, yearMonth] as const,
}

// Hooks
export function useDailyReports(params?: DailyReportQueryParams) {
  return useQuery({
    queryKey: dailyReportKeys.list(params),
    queryFn: () => fetchDailyReports(params),
  })
}

export function useDailyReport(id: string) {
  return useQuery({
    queryKey: dailyReportKeys.detail(id),
    queryFn: () => fetchDailyReport(id),
    enabled: !!id,
  })
}

export function useCreateDailyReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createDailyReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dailyReportKeys.lists() })
    },
  })
}

export function useApproveDailyReport(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: WorkReportApprovalValues) => approveDailyReport(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dailyReportKeys.lists() })
      queryClient.invalidateQueries({ queryKey: dailyReportKeys.detail(id) })
    },
  })
}

export function useMonthlyKpiTotals(staffId: string, projectId: string, yearMonth: string) {
  return useQuery({
    queryKey: dailyReportKeys.monthlyTotals(staffId, projectId, yearMonth),
    queryFn: () => fetchMonthlyKpiTotals(staffId, projectId, yearMonth),
    enabled: !!staffId && !!projectId && !!yearMonth,
  })
}
