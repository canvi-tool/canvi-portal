'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

async function bulkUpdateClientStatus({ ids, status }: { ids: string[]; status: string }): Promise<{ updated: number; status: string }> {
  const res = await fetch('/api/clients/bulk', {
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

export function useBulkUpdateClientStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: bulkUpdateClientStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
