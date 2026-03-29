'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Tables } from '@/lib/types/database'
import type { PaymentUpdateValues } from '@/lib/validations/payment'
import type { MonthlyCalculationSummary } from '@/lib/calculations/types'

// ---- Types ----

export type PaymentCalculation = Tables<'payment_calculations'> & {
  staff: Pick<
    Tables<'staff'>,
    'id' | 'last_name' | 'first_name' | 'last_name_kana' | 'first_name_kana' | 'email' | 'employment_type' | 'status'
  > | null
}

export type PaymentCalculationDetail = PaymentCalculation & {
  lines: Tables<'payment_calculation_lines'>[]
}

export interface PaymentPdfData {
  title: string
  yearMonth: string
  issuedDate: string
  staff: {
    name: string
    nameKana: string
    email: string
    employmentType: string
  }
  lines: {
    name: string
    type: string
    amount: number
    detail: string | null
  }[]
  totalAmount: number
  notes: string | null
}

// ---- Fetchers ----

async function fetchPayments(params: {
  yearMonth?: string
  status?: string
}): Promise<PaymentCalculation[]> {
  const searchParams = new URLSearchParams()
  if (params.yearMonth) searchParams.set('yearMonth', params.yearMonth)
  if (params.status) searchParams.set('status', params.status)
  const res = await fetch(`/api/payments?${searchParams.toString()}`)
  if (!res.ok) throw new Error('支払い情報の取得に失敗しました')
  return res.json()
}

async function fetchPaymentDetail(id: string): Promise<PaymentCalculationDetail> {
  const res = await fetch(`/api/payments/${id}`)
  if (!res.ok) throw new Error('支払い詳細の取得に失敗しました')
  return res.json()
}

async function triggerCalculation(yearMonth: string): Promise<MonthlyCalculationSummary> {
  const res = await fetch('/api/payments/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year_month: yearMonth }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '計算の実行に失敗しました')
  }
  return res.json()
}

async function updatePayment(
  id: string,
  data: PaymentUpdateValues
): Promise<PaymentCalculationDetail> {
  const res = await fetch(`/api/payments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '更新に失敗しました')
  }
  return res.json()
}

async function confirmPayment(
  id: string,
  action: 'confirm' | 'reject' | 'issue'
): Promise<PaymentCalculation> {
  const res = await fetch(`/api/payments/${id}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || '操作に失敗しました')
  }
  return res.json()
}

async function fetchPaymentPdf(id: string): Promise<PaymentPdfData> {
  const res = await fetch(`/api/payments/${id}/pdf`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'PDF情報の取得に失敗しました')
  }
  return res.json()
}

// ---- Query Keys ----

export const paymentKeys = {
  all: ['payments'] as const,
  lists: () => [...paymentKeys.all, 'list'] as const,
  list: (params: { yearMonth?: string; status?: string }) =>
    [...paymentKeys.lists(), params] as const,
  details: () => [...paymentKeys.all, 'detail'] as const,
  detail: (id: string) => [...paymentKeys.details(), id] as const,
  pdf: (id: string) => [...paymentKeys.all, 'pdf', id] as const,
}

// ---- Hooks ----

export function usePayments(params: { yearMonth?: string; status?: string } = {}) {
  return useQuery({
    queryKey: paymentKeys.list(params),
    queryFn: () => fetchPayments(params),
    enabled: !!params.yearMonth,
  })
}

export function usePaymentDetail(id: string) {
  return useQuery({
    queryKey: paymentKeys.detail(id),
    queryFn: () => fetchPaymentDetail(id),
    enabled: !!id,
  })
}

export function usePaymentPdf(id: string) {
  return useQuery({
    queryKey: paymentKeys.pdf(id),
    queryFn: () => fetchPaymentPdf(id),
    enabled: !!id,
  })
}

export function useCalculatePayments() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: triggerCalculation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() })
    },
  })
}

export function useUpdatePayment(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: PaymentUpdateValues) => updatePayment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() })
    },
  })
}

export function useConfirmPayment(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: 'confirm' | 'reject' | 'issue') => confirmPayment(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() })
    },
  })
}
