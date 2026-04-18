import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isPlatformOwner } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AuditLogsTable, type AuditLogRow, type ServiceOption } from './_components/audit-logs-table'

export const dynamic = 'force-dynamic'

type LogRow = {
  id: string
  user_id: string
  service_id: string | null
  service_slug: string
  event: string
  user_email: string | null
  user_name: string | null
  ip_address: string | null
  user_agent: string | null
  error_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export default async function AuditLogsPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')
  if (!isPlatformOwner(currentUser)) {
    redirect('/dashboard')
  }

  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const [logsRes, servicesRes, summaryRes] = await Promise.all([
    sb
      .from('canvi_service_access_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    sb.from('canvi_services').select('id, slug, name').order('sort_order'),
    sb
      .from('canvi_service_access_logs')
      .select('event, service_slug, created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const logs = (logsRes.data ?? []) as LogRow[]
  const services = (servicesRes.data ?? []) as Array<{ id: string; slug: string; name: string }>
  const summary = (summaryRes.data ?? []) as Array<{ event: string; service_slug: string; created_at: string }>

  const slugToName: Record<string, string> = {}
  for (const s of services) slugToName[s.slug] = s.name

  const rows: AuditLogRow[] = logs.map((l) => ({
    id: l.id,
    createdAt: l.created_at,
    userName: l.user_name,
    userEmail: l.user_email,
    serviceSlug: l.service_slug,
    serviceName: slugToName[l.service_slug] ?? l.service_slug,
    event: l.event,
    ipAddress: l.ip_address,
    errorMessage: l.error_message,
  }))

  const serviceOptions: ServiceOption[] = services.map((s) => ({ slug: s.slug, name: s.name }))

  const totalCount = summary.length
  const launchCount = summary.filter((s) => s.event === 'sso_launch').length
  const deniedCount = summary.filter((s) => s.event === 'access_denied').length
  const errorCount = summary.filter((s) => s.event === 'sso_error').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="サービスアクセスログ"
        description="Canvi サービスへのSSOアクセス履歴を表示します。直近100件のログと過去30日間のサマリーを表示します。"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">30日間 合計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SSO起動成功</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{launchCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">アクセス拒否</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{deniedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{errorCount}</div>
          </CardContent>
        </Card>
      </div>

      <AuditLogsTable rows={rows} services={serviceOptions} />
    </div>
  )
}
