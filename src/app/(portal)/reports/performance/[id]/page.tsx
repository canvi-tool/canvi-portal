'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Sparkles, BarChart3, TrendingUp, Phone, CalendarCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/page-header'
import { usePerformanceReport } from '@/hooks/use-reports'
import { REPORT_STATUS_LABELS } from '@/lib/constants'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  submitted: 'secondary',
  approved: 'default',
  rejected: 'destructive',
}

// Helper functions to extract legacy fields from the new summary JSON structure
function getYearMonth(report: { period_start: string }): string {
  return report.period_start?.slice(0, 7) ?? ''
}
function getCallCount(report: { summary: unknown }): number {
  return (report.summary as Record<string, unknown>)?.call_count as number ?? 0
}
function getAppointmentCount(report: { summary: unknown }): number {
  return (report.summary as Record<string, unknown>)?.appointment_count as number ?? 0
}
function getOtherCounts(report: { summary: unknown }): Record<string, number> {
  return ((report.summary as Record<string, unknown>)?.other_counts as Record<string, number>) ?? {}
}

export default function PerformanceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data: report, isLoading } = usePerformanceReport(id)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)

  const handleAiSummary = async () => {
    if (!report) return

    setLoadingAi(true)
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `業務実績サマリー - ${(report as { staff_name?: string }).staff_name || ''} / ${(report as { project_name?: string }).project_name || ''} / ${getYearMonth(report)}\n架電件数: ${getCallCount(report)}\nアポ件数: ${getAppointmentCount(report)}\n${report.notes || ''}`,
          context: 'パフォーマンスレポートの分析と改善提案',
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setAiSummary(data.summary)
      }
    } catch {
      // silently fail
    } finally {
      setLoadingAi(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        業務実績データが見つかりません
      </div>
    )
  }

  const callCount = getCallCount(report)
  const appointmentCount = getAppointmentCount(report)
  const yearMonth = getYearMonth(report)
  const otherCounts = getOtherCounts(report)

  const conversion =
    callCount > 0
      ? Math.round((appointmentCount / callCount) * 100 * 10) / 10
      : 0

  const workReportSummary = (report as {
    work_report_summary?: {
      total_hours: number
      overtime_hours: number
      working_days: number
      standby_hours: number
    }
  }).work_report_summary

  const kpiTargets = (report as {
    kpi_targets?: Array<{
      rule_type: string
      name: string
      params: Record<string, unknown>
    }>
  }).kpi_targets

  return (
    <div className="space-y-6">
      <PageHeader
        title={`業務実績 - ${yearMonth}`}
        description={`${(report as { staff_name?: string }).staff_name || ''} / ${(report as { project_name?: string }).project_name || '未設定'}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[report.status] || 'outline'} className="text-sm">
              {REPORT_STATUS_LABELS[report.status] || report.status}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/reports/performance')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              一覧に戻る
            </Button>
          </div>
        }
      />

      {/* KPI overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">架電件数</p>
            </div>
            <p className="text-3xl font-bold">
              {callCount.toLocaleString('ja-JP')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">アポ件数</p>
            </div>
            <p className="text-3xl font-bold">
              {appointmentCount.toLocaleString('ja-JP')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">アポ率</p>
            </div>
            <p className="text-3xl font-bold">{conversion}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">効率</p>
            </div>
            <p className="text-3xl font-bold">
              {workReportSummary && workReportSummary.total_hours > 0
                ? Math.round((callCount / workReportSummary.total_hours) * 10) / 10
                : '-'}
              <span className="text-sm font-normal text-muted-foreground ml-1">件/h</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work report link */}
        {workReportSummary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">勤務データ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">勤務日数</p>
                  <p className="font-medium text-lg">{workReportSummary.working_days}日</p>
                </div>
                <div>
                  <p className="text-muted-foreground">総勤務時間</p>
                  <p className="font-medium text-lg">{workReportSummary.total_hours}h</p>
                </div>
                <div>
                  <p className="text-muted-foreground">残業時間</p>
                  <p className="font-medium text-lg">{workReportSummary.overtime_hours}h</p>
                </div>
                <div>
                  <p className="text-muted-foreground">待機時間</p>
                  <p className="font-medium text-lg">{workReportSummary.standby_hours}h</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI targets */}
        {kpiTargets && kpiTargets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">報酬ルール / KPI目標</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {kpiTargets.map((target, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium text-sm">{target.name}</p>
                      <p className="text-xs text-muted-foreground">{target.rule_type}</p>
                    </div>
                    <Badge variant="outline">
                      {Object.entries(target.params)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ')}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Other counts */}
        {Object.keys(otherCounts).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">その他実績</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {Object.entries(otherCounts).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-muted-foreground">{key}</p>
                    <p className="font-medium text-lg">{value.toLocaleString('ja-JP')}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Notes */}
      {report.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">備考</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{report.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* AI Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">AI分析</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAiSummary}
            disabled={loadingAi}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            {loadingAi ? '分析中...' : 'AI分析を実行'}
          </Button>
        </CardHeader>
        <CardContent>
          {aiSummary ? (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AIによる分析結果
              </p>
              <p className="text-sm text-purple-900 whitespace-pre-wrap">{aiSummary}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              AI分析を実行すると、業務実績の傾向分析と改善提案が表示されます。
            </p>
          )}
        </CardContent>
      </Card>

      {/* Timestamps */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
            {report.status === 'submitted' && report.updated_at && (
              <span>提出日: {new Date(report.updated_at).toLocaleString('ja-JP')}</span>
            )}
            {report.approved_at && (
              <span>承認日: {new Date(report.approved_at).toLocaleString('ja-JP')}</span>
            )}
            <span>作成日: {new Date(report.created_at).toLocaleString('ja-JP')}</span>
            <span>更新日: {new Date(report.updated_at).toLocaleString('ja-JP')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
