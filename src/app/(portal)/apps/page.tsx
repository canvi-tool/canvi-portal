import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { AppLauncherGrid } from './_components/app-launcher-grid'

export const dynamic = 'force-dynamic'

export default async function AppsPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Canvi サービス一覧を取得（新規テーブルのため any キャストで型回避）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any
  const { data: services } = await supabaseAny
    .from('canvi_services')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // ユーザーに付与されているサービスIDを取得
  const { data: accessRows } = await supabaseAny
    .from('user_service_access')
    .select('service_id')
    .eq('user_id', user.id)

  const grantedSet = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((accessRows ?? []) as any[]).map((r) => r.service_id as string)
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="マイサービス"
        description="Canviエコシステムのサービス一覧。アクセスが許可されているサービスをクリックして開けます。"
      />
      <AppLauncherGrid services={services ?? []} grantedServiceIds={grantedSet} />
    </div>
  )
}
