'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/shared/status-badge'
import { useAuth } from '@/components/providers/auth-provider'
import { CLIENT_STATUS_LABELS } from '@/lib/constants'
import { Pencil, MoreVertical, Trash2 } from 'lucide-react'
import type { Tables } from '@/lib/types/database'

type Client = Tables<'clients'>

interface ClientDetailClientProps {
  client: Client
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-sm">{value || '-'}</span>
    </div>
  )
}

export function ClientDetailClient({ client }: ClientDetailClientProps) {
  const router = useRouter()
  useAuth()
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    fetch('/api/user/current')
      .then((r) => r.json())
      .then((data) => {
        if (data.roles?.includes('owner')) setIsOwner(true)
      })
      .catch(() => {})
  }, [])

  async function handleDelete() {
    if (!confirm('このクライアントを削除しますか？')) return
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('クライアントの削除に失敗しました')
      toast.success('クライアントを削除しました')
      router.push('/clients')
    } catch {
      toast.error('クライアントの削除に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description={`${client.client_code} ${client.industry ? `/ ${client.industry}` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={client.status} labels={CLIENT_STATUS_LABELS} />
            {isOwner && (
              <Button variant="outline" render={<Link href={`/clients/${client.id}/edit`} />}>
                <Pencil className="h-4 w-4 mr-2" />
                編集
              </Button>
            )}
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<button className={buttonVariants({ variant: 'outline', size: 'icon' })} />}
                >
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    削除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="クライアントコード" value={client.client_code} />
            <InfoRow label="クライアント名" value={client.name} />
            <InfoRow label="クライアント名（カナ）" value={client.name_kana} />
            <InfoRow label="業種" value={client.industry} />
            <InfoRow label="住所" value={client.address} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>担当者情報</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="担当者名" value={client.contact_person} />
            <InfoRow label="メール" value={client.contact_email} />
            <InfoRow label="電話番号" value={client.contact_phone} />
          </CardContent>
        </Card>

        {client.notes && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>備考</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
