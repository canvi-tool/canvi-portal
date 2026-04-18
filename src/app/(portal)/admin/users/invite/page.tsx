import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isPlatformOwner } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { InviteUserForm } from './_components/invite-user-form'

export const dynamic = 'force-dynamic'

export default async function AdminUsersInvitePage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')
  if (!isPlatformOwner(currentUser)) {
    redirect('/dashboard')
  }

  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: services } = await sb
    .from('canvi_services')
    .select('id, slug, name, category')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="space-y-6">
      <PageHeader
        title="ユーザー招待"
        description="新規ユーザーを Canvi Portal に招待し、同時にサービスへのアクセス権を付与します。招待メールには初回ログイン用のパスワードが記載されます。"
      />
      <InviteUserForm services={services ?? []} />
    </div>
  )
}
