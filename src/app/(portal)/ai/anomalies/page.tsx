'use client'

import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  Brain,
  AlertTriangle,
  FileText,
  TrendingUp,
  TrendingDown,
  Clock,
  Phone,
  DollarSign,
  CheckCircle2,
  Eye,
  ArrowRight,
  Zap,
  ShieldCheck,
  Activity,
  BarChart3,
  Users,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

type AnomalyStatus = 'unresolved' | 'reviewing' | 'resolved'
type Severity = 'critical' | 'warning' | 'info'
type Sentiment = 'positive' | 'negative' | 'neutral'

interface Anomaly {
  id: string
  type: string
  severity: Severity
  staffName: string
  projectName: string
  date: string
  description: string
  aiExplanation: string
  status: AnomalyStatus
}

interface ReportSummary {
  id: string
  staffName: string
  projectName: string
  period: string
  summary: string
  sentiment: Sentiment
  keyMetrics?: { label: string; value: string; trend?: 'up' | 'down' | 'flat' }[]
}

const ANOMALIES: Anomaly[] = [
  {
    id: '1',
    type: 'shift_no_report',
    severity: 'warning',
    staffName: '田中太郎',
    projectName: 'PJ-Alpha',
    date: '2026-03-25',
    description: 'シフト登録あり（09:00-18:00）だが勤務報告が未提出',
    aiExplanation: '過去3ヶ月で同様の未報告は2回。報告忘れの可能性が高いです。リマインド送信を推奨します。',
    status: 'unresolved',
  },
  {
    id: '2',
    type: 'overtime_anomaly',
    severity: 'critical',
    staffName: '佐藤花子',
    projectName: 'PJ-Beta',
    date: '2026-03-24',
    description: '月間勤務時間が200時間を超過（212時間）',
    aiExplanation: '前月は168時間。今月のPJ-Betaリリース対応で集中的に稼働。36協定の上限に接近しています。即座の対応を推奨。',
    status: 'unresolved',
  },
  {
    id: '3',
    type: 'count_anomaly',
    severity: 'warning',
    staffName: '鈴木一郎',
    projectName: 'PJ-Gamma',
    date: '2026-03-23',
    description: '架電件数が前月平均の200%を超過（150件/日）',
    aiExplanation: '新規リスト投入後の初週で一時的な増加パターン。過去にも同様の傾向あり。品質指標（アポ率）が低下していないか確認を推奨。',
    status: 'reviewing',
  },
  {
    id: '4',
    type: 'adjustment_anomaly',
    severity: 'info',
    staffName: '高橋次郎',
    projectName: 'PJ-Alpha',
    date: '2026-03-22',
    description: '調整額が通常範囲を超過（¥50,000）',
    aiExplanation: '交通費精算の一括計上（3ヶ月分）と確認済み。過去の調整パターンと一致します。',
    status: 'resolved',
  },
  {
    id: '5',
    type: 'shift_no_report',
    severity: 'warning',
    staffName: '山田花子',
    projectName: 'PJ-Delta',
    date: '2026-03-21',
    description: 'シフト登録あり（10:00-19:00）だが勤務報告が未提出',
    aiExplanation: '山田花子は初月スタッフ。報告フローへの不慣れが原因の可能性。オンボーディングサポートを推奨。',
    status: 'unresolved',
  },
  {
    id: '6',
    type: 'time_diff',
    severity: 'warning',
    staffName: '田中太郎',
    projectName: 'PJ-Beta',
    date: '2026-03-26',
    description: 'シフト: 14:00-18:30 / 報告: 14:00-18:00（30分の差異）',
    aiExplanation: 'PJ-Betaでは頻繁に30分程度の前倒し退勤パターンが見られます。シフト自体の見直しを検討してください。',
    status: 'unresolved',
  },
  {
    id: '7',
    type: 'overtime_anomaly',
    severity: 'critical',
    staffName: '渡辺健太',
    projectName: 'PJ-Gamma',
    date: '2026-03-27',
    description: '連続7日間の勤務を検知（休日なし）',
    aiExplanation: '月末の経理処理集中期間。労基法上、週1日の休日確保が必要です。即日の休日設定を推奨。',
    status: 'unresolved',
  },
]

const REPORT_SUMMARIES: ReportSummary[] = [
  {
    id: '1',
    staffName: '田中太郎',
    projectName: 'PJ-Alpha',
    period: '2026年3月',
    summary: 'クライアント対応業務を中心に稼働。新規案件の提案資料作成を3件完了。チーム内でのナレッジ共有セッションを主導。来月はオンボーディング支援に注力予定。',
    sentiment: 'positive',
    keyMetrics: [
      { label: '架電数', value: '342件', trend: 'up' },
      { label: 'アポ率', value: '8.2%', trend: 'up' },
      { label: '稼働時間', value: '168h', trend: 'flat' },
    ],
  },
  {
    id: '2',
    staffName: '佐藤花子',
    projectName: 'PJ-Beta',
    period: '2026年3月',
    summary: '開発タスクの遅延が発生。技術的な課題により当初予定の70%程度の進捗。サポート体制の強化を要望。残業時間の増加傾向に注意が必要。',
    sentiment: 'negative',
    keyMetrics: [
      { label: '進捗率', value: '70%', trend: 'down' },
      { label: '残業時間', value: '44h', trend: 'up' },
      { label: '品質スコア', value: '92点', trend: 'flat' },
    ],
  },
  {
    id: '3',
    staffName: '鈴木一郎',
    projectName: 'PJ-Gamma',
    period: '2026年3月',
    summary: 'テレアポ業務を安定的に実施。目標KPIを達成。新規リスト開拓にも着手し、大手企業2社からの引き合いを獲得。',
    sentiment: 'positive',
    keyMetrics: [
      { label: '架電数', value: '267件', trend: 'up' },
      { label: 'アポ数', value: '22件', trend: 'up' },
      { label: '成約見込', value: '3件', trend: 'up' },
    ],
  },
  {
    id: '4',
    staffName: '高橋めぐみ',
    projectName: 'PJ-Alpha',
    period: '2026年3月',
    summary: '後半シフトを中心に安定稼働。先輩スタッフからのOJTを受けながら、独力でのクライアント対応を開始。成長が著しい。',
    sentiment: 'positive',
    keyMetrics: [
      { label: '架電数', value: '185件', trend: 'up' },
      { label: 'アポ率', value: '5.4%', trend: 'up' },
      { label: '独力対応率', value: '60%', trend: 'up' },
    ],
  },
]

// AI recommendation
const AI_RECOMMENDATIONS = [
  {
    id: 'r1',
    priority: 'high' as const,
    title: '佐藤花子の勤務時間を即座に調整してください',
    reason: '月間212時間で36協定上限に接近。来週のシフトから時間短縮が必要です。',
    action: 'シフト管理で来週のシフトを確認',
    href: '/shifts',
  },
  {
    id: 'r2',
    priority: 'high' as const,
    title: '渡辺健太に休日を設定してください',
    reason: '連続7日勤務。労基法上、最低週1日の休日が必要です。',
    action: 'シフトを確認',
    href: '/shifts',
  },
  {
    id: 'r3',
    priority: 'medium' as const,
    title: '未報告者へのリマインド送信を推奨',
    reason: '3月25日以降の未報告が2件あります。報告提出を促すリマインドが効果的です。',
    action: '勤務報告を確認',
    href: '/reports/work',
  },
  {
    id: 'r4',
    priority: 'low' as const,
    title: 'PJ-Betaのシフト時間を見直してください',
    reason: '30分の差異が頻発しています。実態に合わせたシフト設定で差異を解消できます。',
    action: 'PJ設定を確認',
    href: '/projects',
  },
]

// Weekly trend data (for visual bar chart)
const WEEKLY_TREND = [
  { week: '3/3週', critical: 1, warning: 3, info: 1 },
  { week: '3/2週', critical: 0, warning: 2, info: 2 },
  { week: '3/1週', critical: 2, warning: 4, info: 0 },
  { week: '2/4週', critical: 0, warning: 1, info: 1 },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityVariant(severity: Severity) {
  switch (severity) {
    case 'critical': return 'destructive' as const
    case 'warning': return 'secondary' as const
    default: return 'outline' as const
  }
}

function severityLabel(severity: Severity) {
  switch (severity) {
    case 'critical': return '重大'
    case 'warning': return '警告'
    default: return '情報'
  }
}

function statusLabel(status: AnomalyStatus) {
  switch (status) {
    case 'unresolved': return '未解決'
    case 'reviewing': return '確認中'
    case 'resolved': return '解決済'
  }
}

function statusColor(status: AnomalyStatus) {
  switch (status) {
    case 'unresolved': return 'bg-red-100 text-red-700'
    case 'reviewing': return 'bg-yellow-100 text-yellow-700'
    case 'resolved': return 'bg-green-100 text-green-700'
  }
}

function anomalyTypeIcon(type: string) {
  switch (type) {
    case 'shift_no_report': return <Clock className="h-4 w-4" />
    case 'overtime_anomaly': return <TrendingUp className="h-4 w-4" />
    case 'count_anomaly': return <Phone className="h-4 w-4" />
    case 'adjustment_anomaly': return <DollarSign className="h-4 w-4" />
    case 'time_diff': return <Activity className="h-4 w-4" />
    default: return <AlertTriangle className="h-4 w-4" />
  }
}

function anomalyTypeLabel(type: string) {
  switch (type) {
    case 'shift_no_report': return 'シフトあり/報告なし'
    case 'overtime_anomaly': return '勤務時間異常'
    case 'count_anomaly': return '件数異常'
    case 'adjustment_anomaly': return '調整額異常'
    case 'time_diff': return 'シフト差異'
    default: return '不明'
  }
}

function sentimentIndicator(sentiment: Sentiment) {
  const cfg = {
    positive: { bg: 'bg-green-100 text-green-700', dot: 'bg-green-500', label: 'ポジティブ' },
    negative: { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'ネガティブ' },
    neutral: { bg: 'bg-gray-100 text-gray-700', dot: 'bg-gray-500', label: '中立' },
  }[sentiment]

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function TrendIcon({ trend }: { trend?: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-green-600" />
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />
  return <span className="text-[10px] text-muted-foreground">-</span>
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function AiAnomaliesPage() {
  const [anomalies, setAnomalies] = useState(ANOMALIES)

  const unresolvedCount = anomalies.filter((a) => a.status === 'unresolved').length
  const reviewingCount = anomalies.filter((a) => a.status === 'reviewing').length
  const resolvedCount = anomalies.filter((a) => a.status === 'resolved').length
  const criticalCount = anomalies.filter((a) => a.severity === 'critical' && a.status !== 'resolved').length

  function handleMarkReviewing(id: string) {
    setAnomalies((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'reviewing' as const } : a)))
  }

  function handleMarkResolved(id: string) {
    setAnomalies((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'resolved' as const } : a)))
  }

  // Group anomalies by type for breakdown
  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of anomalies) {
      if (a.status === 'resolved') continue
      map[a.type] = (map[a.type] || 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [anomalies])

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI分析"
        description="AIによる異常検知・パターン分析・定性報告の要約"
        actions={
          <div className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
            <Brain className="h-4 w-4" />
            AI解析エンジン稼働中
          </div>
        }
      />

      {/* Summary stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className={cn(criticalCount > 0 && 'border-red-200')}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">重大な異常</span>
              <AlertTriangle className={cn('h-4 w-4', criticalCount > 0 ? 'text-red-500' : 'text-muted-foreground')} />
            </div>
            <div className={cn('text-2xl font-bold', criticalCount > 0 && 'text-red-600')}>{criticalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">未解決</span>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{unresolvedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">確認中</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{reviewingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">解決済</span>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">{resolvedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendations */}
      {AI_RECOMMENDATIONS.length > 0 && (
        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-indigo-600" />
              AIからの推奨アクション
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {AI_RECOMMENDATIONS.map((rec) => (
                <div
                  key={rec.id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border bg-white p-3',
                    rec.priority === 'high' && 'border-red-200',
                    rec.priority === 'medium' && 'border-amber-200',
                    rec.priority === 'low' && 'border-gray-200',
                  )}
                >
                  <div className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white',
                    rec.priority === 'high' && 'bg-red-500',
                    rec.priority === 'medium' && 'bg-amber-500',
                    rec.priority === 'low' && 'bg-gray-400',
                  )}>
                    {rec.priority === 'high' ? '!' : rec.priority === 'medium' ? '-' : '~'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{rec.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{rec.reason}</p>
                  </div>
                  <a href={rec.href} className="shrink-0">
                    <Button variant="ghost" size="sm" className="text-xs h-7">
                      {rec.action}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend + Type breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weekly trend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              週次トレンド
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {WEEKLY_TREND.map((week) => {
                const total = week.critical + week.warning + week.info
                const maxBar = 8
                return (
                  <div key={week.week} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-[50px] shrink-0">{week.week}</span>
                    <div className="flex-1 flex items-center gap-0.5">
                      {week.critical > 0 && (
                        <div className="bg-red-500 rounded-sm h-5" style={{ width: `${(week.critical / maxBar) * 100}%` }} />
                      )}
                      {week.warning > 0 && (
                        <div className="bg-amber-400 rounded-sm h-5" style={{ width: `${(week.warning / maxBar) * 100}%` }} />
                      )}
                      {week.info > 0 && (
                        <div className="bg-blue-300 rounded-sm h-5" style={{ width: `${(week.info / maxBar) * 100}%` }} />
                      )}
                    </div>
                    <span className="text-xs font-medium w-[30px] text-right">{total}件</span>
                  </div>
                )
              })}
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1 border-t">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" /> 重大</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400" /> 警告</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-300" /> 情報</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Type breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              異常タイプ別（未解決）
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2.5">
              {typeBreakdown.map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    {anomalyTypeIcon(type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{anomalyTypeLabel(type)}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{count}件</Badge>
                </div>
              ))}
              {typeBreakdown.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  <ShieldCheck className="h-6 w-6 mx-auto mb-1 text-green-500" />
                  未解決の異常はありません
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="anomalies">
        <TabsList>
          <TabsTrigger value="anomalies">
            <AlertTriangle className="h-4 w-4" />
            異常検知一覧
          </TabsTrigger>
          <TabsTrigger value="summaries">
            <FileText className="h-4 w-4" />
            定性報告要約
          </TabsTrigger>
        </TabsList>

        {/* ---- Anomaly detection tab ---- */}
        <TabsContent value="anomalies">
          <div className="space-y-3 pt-4">
            {anomalies.map((anomaly) => (
              <Card key={anomaly.id} className={cn(anomaly.status === 'resolved' && 'opacity-60')}>
                <CardHeader className="flex flex-row items-start gap-3 pb-2">
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    anomaly.severity === 'critical' ? 'bg-red-100 text-red-600' :
                    anomaly.severity === 'warning' ? 'bg-amber-100 text-amber-600' :
                    'bg-blue-100 text-blue-600'
                  )}>
                    {anomalyTypeIcon(anomaly.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-sm font-semibold">
                        {anomalyTypeLabel(anomaly.type)}
                      </CardTitle>
                      <Badge variant={severityVariant(anomaly.severity)}>
                        {severityLabel(anomaly.severity)}
                      </Badge>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(anomaly.status)}`}>
                        {statusLabel(anomaly.status)}
                      </span>
                    </div>
                    <CardDescription className="text-xs">
                      {anomaly.staffName} / {anomaly.projectName} &mdash; {anomaly.date}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{anomaly.description}</p>

                  {/* AI explanation */}
                  <div className="mt-2 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-2.5">
                    <div className="flex items-center gap-1 text-[10px] font-medium text-indigo-600 mb-1">
                      <Brain className="h-3 w-3" />
                      AI分析
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed">{anomaly.aiExplanation}</p>
                  </div>

                  {anomaly.status !== 'resolved' && (
                    <div className="mt-3 flex gap-2">
                      {anomaly.status === 'unresolved' && (
                        <Button variant="outline" size="sm" onClick={() => handleMarkReviewing(anomaly.id)}>
                          確認中にする
                        </Button>
                      )}
                      <Button variant="default" size="sm" onClick={() => handleMarkResolved(anomaly.id)}>
                        解決済にする
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ---- Report summaries tab ---- */}
        <TabsContent value="summaries">
          <div className="space-y-4 pt-4">
            <Card className="border-indigo-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-5 w-5 text-indigo-600" />
                  スタッフ月次サマリー
                </CardTitle>
                <CardDescription>
                  各スタッフの定性報告をAIが要約し、KPIトレンドと併せて支払確認の判断材料を提供します
                </CardDescription>
              </CardHeader>
            </Card>

            {REPORT_SUMMARIES.map((report) => (
              <Card key={report.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {report.staffName}
                      <span className="font-normal text-muted-foreground">{report.projectName}</span>
                    </CardTitle>
                    {sentimentIndicator(report.sentiment)}
                  </div>
                  <CardDescription className="text-xs">{report.period}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Key metrics */}
                  {report.keyMetrics && (
                    <div className="flex items-center gap-4 flex-wrap">
                      {report.keyMetrics.map((metric) => (
                        <div key={metric.label} className="flex items-center gap-1.5 rounded-md border px-2.5 py-1">
                          <span className="text-[10px] text-muted-foreground">{metric.label}</span>
                          <span className="text-xs font-bold">{metric.value}</span>
                          <TrendIcon trend={metric.trend} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI summary */}
                  <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-indigo-600">
                      <Brain className="h-3 w-3" />
                      AI要約
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{report.summary}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
