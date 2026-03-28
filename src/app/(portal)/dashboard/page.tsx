import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Wallet, Bell, Briefcase, AlertTriangle, FileText } from 'lucide-react'

// Placeholder data - will be replaced with actual queries later
const SUMMARY_DATA = {
  staffCount: 42,
  monthlyPayment: 8_350_000,
  unresolvedAlerts: 5,
  activeProjects: 12,
}

const RECENT_ALERTS = [
  { id: '1', type: '未報告', message: '田中太郎 - 3月15日の勤務報告が未提出です', severity: 'warning', createdAt: '2026-03-26' },
  { id: '2', type: '契約未締結', message: '佐藤花子 - 契約書の署名が1週間以上未完了です', severity: 'critical', createdAt: '2026-03-25' },
  { id: '3', type: 'シフト差異', message: '鈴木一郎 - 3月14日のシフトと実績に2時間の差異があります', severity: 'warning', createdAt: '2026-03-25' },
  { id: '4', type: '異常検知', message: 'プロジェクトAの稼働時間が前月比150%を超えています', severity: 'info', createdAt: '2026-03-24' },
  { id: '5', type: '送付失敗', message: '山田次郎への契約書メール送付が失敗しました', severity: 'critical', createdAt: '2026-03-24' },
]

const PENDING_ACTIONS = [
  { id: '1', type: 'payment', label: '3月分支払確認', description: '未確定の支払が3件あります' },
  { id: '2', type: 'contract', label: '契約書署名待ち', description: '署名待ちの契約が2件あります' },
  { id: '3', type: 'report', label: '勤務報告承認', description: '未承認の報告が7件あります' },
]

function SummaryCard({
  title,
  value,
  icon: Icon,
  format,
}: {
  title: string
  value: number
  icon: React.ElementType
  format?: 'currency' | 'number'
}) {
  const formattedValue =
    format === 'currency'
      ? `\u00A5${value.toLocaleString('ja-JP')}`
      : value.toLocaleString('ja-JP')

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
      </CardContent>
    </Card>
  )
}

function severityVariant(severity: string) {
  switch (severity) {
    case 'critical':
      return 'destructive' as const
    case 'warning':
      return 'secondary' as const
    default:
      return 'outline' as const
  }
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const displayName = user?.user_metadata?.full_name || user?.email || 'ユーザー'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`おかえりなさい、${displayName}さん`}
        description="本日の業務概要です"
      />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="スタッフ数"
          value={SUMMARY_DATA.staffCount}
          icon={Users}
        />
        <SummaryCard
          title="今月の支払"
          value={SUMMARY_DATA.monthlyPayment}
          icon={Wallet}
          format="currency"
        />
        <SummaryCard
          title="未処理アラート"
          value={SUMMARY_DATA.unresolvedAlerts}
          icon={Bell}
        />
        <SummaryCard
          title="進行中PJ"
          value={SUMMARY_DATA.activeProjects}
          icon={Briefcase}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              最近のアラート
            </CardTitle>
            <CardDescription>直近のアラート5件</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {RECENT_ALERTS.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <Badge variant={severityVariant(alert.severity)}>
                    {alert.type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {alert.createdAt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              保留中のアクション
            </CardTitle>
            <CardDescription>対応が必要な項目</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {PENDING_ACTIONS.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    {action.type === 'payment' && <Wallet className="h-5 w-5" />}
                    {action.type === 'contract' && <FileText className="h-5 w-5" />}
                    {action.type === 'report' && <Briefcase className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
