'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { ClientForm } from '../_components/client-form'
import type { ClientFormValues } from '@/lib/validations/client'
import { useState, useEffect } from 'react'

export default function NewClientPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [nextCode, setNextCode] = useState<string>('')

  useEffect(() => {
    fetch('/api/clients/next-code')
      .then((res) => res.json())
      .then((data) => {
        if (data.code) setNextCode(data.code)
      })
      .catch(() => {})
  }, [])

  async function handleSubmit(data: ClientFormValues) {
    try {
      setIsLoading(true)
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'クライアントの登録に失敗しました')
      }

      const created = await res.json()
      toast.success('クライアントを登録しました')
      router.push(`/clients/${created.id}`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'クライアントの登録に失敗しました'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="クライアント新規登録"
        description="新しいクライアントの情報を入力してください"
      />
      {nextCode && (
        <ClientForm
          onSubmit={handleSubmit}
          isLoading={isLoading}
          defaultValues={{ client_code: nextCode }}
          codeReadOnly
        />
      )}
    </div>
  )
}
