import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/rbac'
import { isSuperAdmin } from '@/lib/auth/super-admin'
import { PageHeader } from '@/components/layout/page-header'
import { TenantManager } from './_components/tenant-manager'

export const dynamic = 'force-dynamic'

export default async function SuperAdminTenantsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!isSuperAdmin(user)) redirect('/dashboard')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any
  const { data: tenants } = await sb
    .from('master_tenants')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <PageHeader
        title="全サービス テナント管理"
        description="Canvi 全5サービス（Canvas / テレアポくん / AI社畜 / オペマネ / 達人）のテナントを株式会社Canvi が一元管理します。作成・編集・論理削除は各サービスDBへ自動反映されます。"
      />
      <TenantManager initialTenants={tenants ?? []} />
    </div>
  )
}
