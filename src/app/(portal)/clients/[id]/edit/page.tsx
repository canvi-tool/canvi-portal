'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { ClientForm } from '../../_components/client-form'
import type { ClientFormValues } from '@/lib/validations/client'

interface EditClientPageProps {
  params: Promise<{ id: string }>
}

export default function EditClientPage({ params }: EditClientPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [client, setClient] = useState<Record<string, unknown> | null>(null)
  const [isLoadingClient, setIsLoadingClient] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function fetchClient() {
      try {
        const res = await fetch(`/api/clients/${id}`)
        if (!res.ok) throw new Error('Client not found')
        const data = await res.json()
        setClient(data)
      } catch {
        setClient(null)
      } finally {
        setIsLoadingClient(false)
      }
    }
    fetchClient()
  }, [id])

  async function handleSubmit(data: ClientFormValues) {
    try {
      setIsSubmitting(true)
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'クライアントの更新に失敗しました')
      }

      toast.success('クライアント情報を更新しました')
      router.push(`/clients/${id}`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'クライアントの更新に失敗しました'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingClient) {
    return (
      <div className="space-y-6">
        <PageHeader title="クライアント編集" />
        <LoadingSkeleton variant="form" rows={8} />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="space-y-6">
        <PageHeader title="クライアント編集" />
        <p className="text-muted-foreground">クライアントが見つかりません</p>
      </div>
    )
  }

  // Extract form values from client record
  const defaultValues: Partial<ClientFormValues> = {
    client_code: (client.client_code as string) || '',
    name: (client.name as string) || '',
    name_kana: (client.name_kana as string) || '',
    contact_person: (client.contact_person as string) || '',
    contact_email: (client.contact_email as string) || '',
    contact_phone: (client.contact_phone as string) || '',
    address: (client.address as string) || '',
    industry: (client.industry as string) || '',
    notes: (client.notes as string) || '',
    status: (client.status as 'active' | 'inactive') || 'active',
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="クライアント編集"
        description={`${client.name} の情報を編集`}
      />
      <ClientForm
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
      />
    </div>
  )
}
