import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isPlatformOwner } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { ServiceAccessManager } from './_components/service-access-manager'
import { PortalInviteDialog } from './_components/portal-invite-dialog'

export const dynamic = 'force-dynamic'

export default async function AdminServicesPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')
  // プラットフォーム管理者（岡林）のみアクセス可
  if (!isPlatformOwner(currentUser)) {
    redirect('/dashboard')
  }

  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const [servicesRes, staffRes, accessRes] = await Promise.all([
    sb.from('canvi_services').select('*').eq('is_active', true).order('sort_order'),
    sb.from('staff').select('id, last_name, first_name, email, user_id').eq('status', 'active').order('last_name'),
    sb.from('user_service_access').select('user_id, service_id'),
  ])

  const services = servicesRes.data ?? []
  const staff = staffRes.data ?? []
  const accessMap: Record<string, Set<string>> = {}
  for (const row of (accessRes.data ?? []) as Array<{ user_id: string; service_id: string }>) {
    if (!accessMap[row.user_id]) accessMap[row.user_id] = new Set()
    accessMap[row.user_id].add(row.service_id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="サービス付与管理"
          description="ユーザーに Canvi サービスへのアクセス権を付与/剥奪します。付与されたサービスは各ユーザーの「マイサービス」ページで利用可能になります。"
        />
        <PortalInviteDialog services={services} />
      </div>
      <ServiceAccessManager services={services} staff={staff} accessMap={accessMap} />
    </div>
  )
}
