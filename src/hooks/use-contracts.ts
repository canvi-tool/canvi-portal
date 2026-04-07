'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ContractFormValues, ContractTemplateFormValues } from '@/lib/validations/contract'
import type { Tables } from '@/lib/types/database'

type Contract = Tables<'contracts'>
type ContractTemplate = Tables<'contract_templates'>

// ─── Contract Types ──────────────────────────────────

interface ContractListParams {
  search?: string
  status?: string
  page?: number
  limit?: number
}

interface ContractListResponse {
  data: (Contract & { staff: Tables<'staff'> | null; template: ContractTemplate | null })[]
  total: number
  page: number
  limit: number
}

type ContractDetail = Contract & {
  staff: Tables<'staff'> | null
  template: ContractTemplate | null
  // Legacy/extra columns not in regenerated DB types
  content?: string | null
  variables?: Record<string, unknown> | null
  external_sign_id?: string | null
  external_sign_url?: string | null
  signed_at?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

// ─── Template Types ──────────────────────────────────

interface TemplateListParams {
  search?: string
  is_active?: string
  page?: number
  limit?: number
}

interface TemplateListResponse {
  data: ContractTemplate[]
  total: number
  page: number
  limit: number
}

// ─── Contract API Functions ──────────────────────────

async function fetchContractList(params: ContractListParams): Promise<ContractListResponse> {
  const searchParams = new URLSearchParams()
  if (params.search) searchParams.set('search', params.search)
  if (params.status) searchParams.set('status', params.status)
  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))

  const res = await fetch(`/api/contracts?${searchParams.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '契約一覧の取得に失敗しました' }))
    throw new Error(err.error || '契約一覧の取得に失敗しました')
  }
  return res.json()
}

async function fetchContract(id: string): Promise<ContractDetail> {
  const res = await fetch(`/api/contracts/${id}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '契約の取得に失敗しました' }))
    throw new Error(err.error || '契約の取得に失敗しました')
  }
  return res.json()
}

async function createContract(data: ContractFormValues): Promise<Contract> {
  const res = await fetch('/api/contracts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '契約の作成に失敗しました' }))
    throw new Error(err.error || '契約の作成に失敗しました')
  }
  return res.json()
}

async function updateContract({ id, data }: { id: string; data: Partial<ContractFormValues> }): Promise<Contract> {
  const res = await fetch(`/api/contracts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '契約の更新に失敗しました' }))
    throw new Error(err.error || '契約の更新に失敗しました')
  }
  return res.json()
}

async function deleteContract(id: string): Promise<void> {
  const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '契約の削除に失敗しました' }))
    throw new Error(err.error || '契約の削除に失敗しました')
  }
}

async function generateContractPdf(id: string): Promise<Blob> {
  const res = await fetch(`/api/contracts/${id}/pdf`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'PDF生成に失敗しました' }))
    throw new Error(err.error || 'PDF生成に失敗しました')
  }
  return res.blob()
}

async function sendContractForSigning(id: string): Promise<Contract> {
  const res = await fetch(`/api/contracts/${id}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '署名依頼の送信に失敗しました' }))
    throw new Error(err.error || '署名依頼の送信に失敗しました')
  }
  return res.json()
}

async function updateContractStatus({
  id,
  status,
}: {
  id: string
  status: string
}): Promise<Contract> {
  const res = await fetch(`/api/contracts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'ステータスの更新に失敗しました' }))
    throw new Error(err.error || 'ステータスの更新に失敗しました')
  }
  return res.json()
}

// ─── Template API Functions ──────────────────────────

async function fetchTemplateList(params: TemplateListParams): Promise<TemplateListResponse> {
  const searchParams = new URLSearchParams()
  if (params.search) searchParams.set('search', params.search)
  if (params.is_active) searchParams.set('is_active', params.is_active)
  if (params.page) searchParams.set('page', String(params.page))
  if (params.limit) searchParams.set('limit', String(params.limit))

  const res = await fetch(`/api/contracts/templates?${searchParams.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'テンプレート一覧の取得に失敗しました' }))
    throw new Error(err.error || 'テンプレート一覧の取得に失敗しました')
  }
  return res.json()
}

async function fetchTemplate(id: string): Promise<ContractTemplate> {
  const res = await fetch(`/api/contracts/templates/${id}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'テンプレートの取得に失敗しました' }))
    throw new Error(err.error || 'テンプレートの取得に失敗しました')
  }
  return res.json()
}

async function createTemplate(data: ContractTemplateFormValues): Promise<ContractTemplate> {
  const res = await fetch('/api/contracts/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'テンプレートの作成に失敗しました' }))
    throw new Error(err.error || 'テンプレートの作成に失敗しました')
  }
  return res.json()
}

async function updateTemplate({
  id,
  data,
}: {
  id: string
  data: Partial<ContractTemplateFormValues>
}): Promise<ContractTemplate> {
  const res = await fetch(`/api/contracts/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'テンプレートの更新に失敗しました' }))
    throw new Error(err.error || 'テンプレートの更新に失敗しました')
  }
  return res.json()
}

async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`/api/contracts/templates/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'テンプレートの削除に失敗しました' }))
    throw new Error(err.error || 'テンプレートの削除に失敗しました')
  }
}

// ─── Contract Hooks ──────────────────────────────────

export function useContractList(params: ContractListParams = {}) {
  return useQuery({
    queryKey: ['contracts', 'list', params],
    queryFn: () => fetchContractList(params),
  })
}

export function useContract(id: string) {
  return useQuery({
    queryKey: ['contracts', 'detail', id],
    queryFn: () => fetchContract(id),
    enabled: !!id,
  })
}

export function useCreateContract() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', 'list'] })
    },
  })
}

export function useUpdateContract(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ContractFormValues>) => updateContract({ id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['contracts', 'detail', id] })
    },
  })
}

export function useDeleteContract() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', 'list'] })
    },
  })
}

export function useGenerateContractPdf() {
  return useMutation({
    mutationFn: generateContractPdf,
  })
}

export function useSendContractForSigning() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sendContractForSigning,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['contracts', 'detail', id] })
      queryClient.invalidateQueries({ queryKey: ['contracts', 'list'] })
    },
  })
}

export function useUpdateContractStatus(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: string) => updateContractStatus({ id, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', 'detail', id] })
      queryClient.invalidateQueries({ queryKey: ['contracts', 'list'] })
    },
  })
}

// ─── Template Hooks ──────────────────────────────────

export function useTemplateList(params: TemplateListParams = {}) {
  return useQuery({
    queryKey: ['contract-templates', 'list', params],
    queryFn: () => fetchTemplateList(params),
  })
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: ['contract-templates', 'detail', id],
    queryFn: () => fetchTemplate(id),
    enabled: !!id,
  })
}

export function useCreateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates', 'list'] })
    },
  })
}

export function useUpdateTemplate(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ContractTemplateFormValues>) => updateTemplate({ id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['contract-templates', 'detail', id] })
    },
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates', 'list'] })
    },
  })
}
