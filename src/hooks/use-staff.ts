'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { StaffFormValues } from '@/lib/validations/staff'
import type { ProvisioningData } from '@/app/(portal)/staff/_components/staff-form'
import type { Tables } from '@/lib/types/database'

type Staff = Tables<'staff'>

export interface ProvisioningResult {
  google_workspace?: { success: boolean; email?: string; error?: string }
  zoom?: { success: boolean; email?: string; error?: string }
}

export interface CreateStaffResponse extends Staff {
  provisioning?: ProvisioningResult
}

interface StaffListParams {
  search?: string
  status?: string
  employment_type?: string
  page?: number
  limit?: number
}

interface StaffListResponse {
  data: Staff[]
  total: number
  page: number
  limit: number
}

async function fetchStaffList(params: StaffListParams): Promise<StaffListResponse> {
  const searchParams = new URLSearchParams()
  if (params.search) searchParams.set('search', params.search)
  if (params.status) searchParams.set('status', params.status)
  if (params.employment_type) searchParams.set('employment_type', params.employment_type)
  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))

  const res = await fetch(`/api/staff?${searchParams.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'スタッフ一覧の取得に失敗しました' }))
    throw new Error(err.error || 'スタッフ一覧の取得に失敗しました')
  }
  return res.json()
}

async function fetchStaff(id: string): Promise<Staff & { contracts: Tables<'contracts'>[]; project_assignments: (Tables<'project_assignments'> & { project: Tables<'projects'> | null })[] }> {
  const res = await fetch(`/api/staff/${id}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'スタッフの取得に失敗しました' }))
    throw new Error(err.error || 'スタッフの取得に失敗しました')
  }
  return res.json()
}

interface CreateStaffInput {
  formData: StaffFormValues
  provisioning?: ProvisioningData
}

async function createStaff({ formData, provisioning }: CreateStaffInput): Promise<CreateStaffResponse> {
  const res = await fetch('/api/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...formData,
      ...(provisioning ? {
        create_google_account: provisioning.create_google_account,
        google_email_prefix: provisioning.google_email_prefix,
        google_org_unit: provisioning.google_org_unit,
        create_zoom_account: provisioning.create_zoom_account,
        zoom_license_type: provisioning.zoom_license_type,
      } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'スタッフの作成に失敗しました' }))
    throw new Error(err.error || 'スタッフの作成に失敗しました')
  }
  return res.json()
}

async function updateStaff({ id, data }: { id: string; data: StaffFormValues }): Promise<Staff> {
  const res = await fetch(`/api/staff/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'スタッフの更新に失敗しました' }))
    throw new Error(err.error || 'スタッフの更新に失敗しました')
  }
  return res.json()
}

async function deleteStaff(id: string): Promise<void> {
  const res = await fetch(`/api/staff/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'スタッフの削除に失敗しました' }))
    throw new Error(err.error || 'スタッフの削除に失敗しました')
  }
}

export function useStaffList(params: StaffListParams = {}) {
  return useQuery({
    queryKey: ['staff', 'list', params],
    queryFn: () => fetchStaffList(params),
  })
}

export function useStaff(id: string) {
  return useQuery({
    queryKey: ['staff', 'detail', id],
    queryFn: () => fetchStaff(id),
    enabled: !!id,
  })
}

export function useCreateStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateStaffInput) => createStaff(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'list'] })
    },
  })
}

export function useUpdateStaff(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: StaffFormValues) => updateStaff({ id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['staff', 'detail', id] })
    },
  })
}

export function useDeleteStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'list'] })
    },
  })
}

async function bulkUpdateStaffStatus({ ids, status }: { ids: string[]; status: string }): Promise<{ updated: number; status: string }> {
  const res = await fetch('/api/staff/bulk', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '一括更新に失敗しました' }))
    throw new Error(err.error || '一括更新に失敗しました')
  }
  return res.json()
}

export function useBulkUpdateStaffStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: bulkUpdateStaffStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'list'] })
    },
  })
}
