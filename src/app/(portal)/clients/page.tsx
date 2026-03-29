import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ClientListClient } from './_components/client-list-client'

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient()

  const { data: clientList, error } = await supabase
    .from('clients')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Clients page query error:', error)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="クライアント管理"
        description="クライアントの一覧と管理"
        actions={
          <div className="flex items-center gap-2">
            <Button render={<Link href="/clients/new" />}>
              <Plus className="h-4 w-4 mr-2" />
              新規登録
            </Button>
          </div>
        }
      />
      <ClientListClient initialData={clientList || []} />
    </div>
  )
}
