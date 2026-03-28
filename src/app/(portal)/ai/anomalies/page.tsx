'use client'

import { useState } from 'react'
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
import {
  Brain,
  AlertTriangle,
  FileText,
  TrendingUp,
  Clock,
  Phone,
  DollarSign,
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
  status: AnomalyStatus
}

interface ReportSummary {
  id: string
  staffName: string
  projectName: string
  period: string
  summary: string
  sentiment: Sentiment
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
    status: 'unresolved',
  },
]

const REPORT_SUMMARIES: ReportSummary[] = [
  {
    id: '1',
    staffName: '田中太郎',
    projectName: 'PJ-Alpha',
    period: '2026年3月',
    summary:
      'クライアント対応業務を中心に稼働。新規案件の提案資料作成を3件完了。チーム内でのナレッジ共有セッションを主導。来月はオンボーディング支援に注力予定。',
    sentiment: 'positive',
  },
  {
    id: '2',
    staffName: '佐藤花子',
    projectName: 'PJ-Beta',
    period: '2026年3月',
    summary:
      '開発タスクの遅延が発生。技術的な課題により当初予定の70%程度の進捗。サポート体制の強化を要望。',
    sentiment: 'negative',
  },
  {
    id: '3',
    staffName: '鈴木一郎',
    projectName: 'PJ-Gamma',
    period: '2026年3月',
    summary:
      'テレアポ業務を安定的に実施。目標KPIを達成。新規リスト開拓にも着手。',
    sentiment: 'positive',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityVariant(severity: Severity) {
  switch (severity) {
    case 'critical':
      return 'destructive' as const
    case 'warning':
      return 'secondary' as const
    default:
      return 'outline' as const
  }
}

function severityLabel(severity: Severity) {
  switch (severity) {
    case 'critical':
      return '重大'
    case 'warning':
      return '警告'
    default:
      return '情報'
  }
}

function statusLabel(status: AnomalyStatus) {
  switch (status) {
    case 'unresolved':
      return '未解決'
    case 'reviewing':
      return '確認中'
    case 'resolved':
      return '解決済'
  }
}

function statusColor(status: AnomalyStatus) {
  switch (status) {
    case 'unresolved':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'reviewing':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'resolved':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  }
}

function anomalyTypeIcon(type: string) {
  switch (type) {
    case 'shift_no_report':
      return <Clock className="h-4 w-4" />
    case 'overtime_anomaly':
      return <TrendingUp className="h-4 w-4" />
    case 'count_anomaly':
      return <Phone className="h-4 w-4" />
    case 'adjustment_anomaly':
      return <DollarSign className="h-4 w-4" />
    default:
      return <AlertTriangle className="h-4 w-4" />
  }
}

function anomalyTypeLabel(type: string) {
  switch (type) {
    case 'shift_no_report':
      return 'シフトあり/報告なし'
    case 'overtime_anomaly':
      return '勤務時間異常'
    case 'count_anomaly':
      return '件数異常'
    case 'adjustment_anomaly':
      return '調整額異常'
    default:
      return '不明'
  }
}

function sentimentIndicator(sentiment: Sentiment) {
  switch (sentiment) {
    case 'positive':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          ポジティブ
        </span>
      )
    case 'negative':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          ネガティブ
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
          中立
        </span>
      )
  }
}

// ---------------------------------------------------------------------------
// Summary stat card
// ---------------------------------------------------------------------------

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: number
  icon: React.ElementType
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function AiAnomaliesPage() {
  const [anomalies, setAnomalies] = useState(ANOMALIES)

  const unresolvedCount = anomalies.filter(
    (a) => a.status === 'unresolved'
  ).length
  const reviewingCount = anomalies.filter(
    (a) => a.status === 'reviewing'
  ).length
  const resolvedCount = anomalies.filter(
    (a) => a.status === 'resolved'
  ).length
  const summaryCount = REPORT_SUMMARIES.length

  function handleMarkReviewing(id: string) {
    setAnomalies((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'reviewing' as const } : a))
    )
  }

  function handleMarkResolved(id: string) {
    setAnomalies((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'resolved' as const } : a))
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI分析"
        description="AIによる異常検知と定性報告の要約"
        actions={
          <div className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
            <Brain className="h-4 w-4" />
            AI解析エンジン稼働中
          </div>
        }
      />

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="未解決の異常"
          value={unresolvedCount}
          icon={AlertTriangle}
        />
        <StatCard title="確認中" value={reviewingCount} icon={Clock} />
        <StatCard title="解決済" value={resolvedCount} icon={TrendingUp} />
        <StatCard title="要約生成済" value={summaryCount} icon={FileText} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="anomalies">
        <TabsList>
          <TabsTrigger value="anomalies">
            <AlertTriangle className="h-4 w-4" />
            異常検知
          </TabsTrigger>
          <TabsTrigger value="summaries">
            <FileText className="h-4 w-4" />
            定性報告要約
          </TabsTrigger>
        </TabsList>

        {/* ---- Anomaly detection tab ---- */}
        <TabsContent value="anomalies">
          <div className="space-y-4 pt-4">
            {anomalies.map((anomaly) => (
              <Card key={anomaly.id}>
                <CardHeader className="flex flex-row items-start gap-3 pb-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
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
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(anomaly.status)}`}
                      >
                        {statusLabel(anomaly.status)}
                      </span>
                    </div>
                    <CardDescription className="text-xs">
                      {anomaly.staffName} / {anomaly.projectName} &mdash;{' '}
                      {anomaly.date}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground/80">
                    {anomaly.description}
                  </p>
                  {anomaly.status !== 'resolved' && (
                    <div className="mt-3 flex gap-2">
                      {anomaly.status === 'unresolved' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkReviewing(anomaly.id)}
                        >
                          確認中にする
                        </Button>
                      )}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleMarkResolved(anomaly.id)}
                      >
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-5 w-5 text-indigo-600" />
                  支払確認時の補助表示
                </CardTitle>
                <CardDescription>
                  各スタッフの定性報告をAIが要約し、支払確認時の判断材料を提供します
                </CardDescription>
              </CardHeader>
            </Card>

            {REPORT_SUMMARIES.map((report) => (
              <Card key={report.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold">
                      {report.staffName}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {report.projectName}
                      </span>
                    </CardTitle>
                    {sentimentIndicator(report.sentiment)}
                  </div>
                  <CardDescription className="text-xs">
                    {report.period}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-800 dark:bg-indigo-950/30">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      <Brain className="h-3 w-3" />
                      AI要約
                    </div>
                    <p className="text-sm text-foreground/80">
                      {report.summary}
                    </p>
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
