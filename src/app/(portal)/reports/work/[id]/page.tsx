'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle, XCircle, Loader2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/page-header'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import {
  useDailyReport,
  useApproveDailyReport,
  useDeleteDailyReport,
} from '@/hooks/use-daily-reports'
import {
  DAILY_REPORT_TYPE_LABELS,
  DAILY_REPORT_STATUS_LABELS,
  calcOutboundRates,
  calcInboundRates,
} from '@/lib/validations/daily-report'
import type { DailyReportType } from '@/lib/validations/daily-report'

// ---------- helpers ----------

function statusBadge(status: string) {
  switch (status) {
    case 'approved':
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          {DAILY_REPORT_STATUS_LABELS[status]}
        </Badge>
      )
    case 'rejected':
      return (
        <Badge variant="destructive">
          {DAILY_REPORT_STATUS_LABELS[status]}
        </Badge>
      )
    case 'draft':
      return (
        <Badge variant="secondary">
          {DAILY_REPORT_STATUS_LABELS[status]}
        </Badge>
      )
    case 'submitted':
    default:
      return (
        <Badge variant="default">
          {DAILY_REPORT_STATUS_LABELS[status] ?? status}
        </Badge>
      )
  }
}

function typeBadge(type: DailyReportType) {
  return (
    <Badge variant="outline">{DAILY_REPORT_TYPE_LABELS[type] ?? type}</Badge>
  )
}

/** Label + value block */
function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{String(value)}</p>
    </div>
  )
}

/** Render stars for concentration level */
function Stars({ level }: { level?: number | null }) {
  if (!level) return null
  return (
    <span className="text-sm">
      {'★'.repeat(level)}
      {'☆'.repeat(5 - level)}
      <span className="ml-1 text-muted-foreground">({level}/5)</span>
    </span>
  )
}

// ---------- sub-renderers ----------

function TrainingContent({ cf }: { cf: Record<string, unknown> }) {
  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="日付" value={cf.report_date as string} />
          <Field label="テーマ" value={cf.study_theme as string} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">理解度</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="スムーズにできたこと" value={cf.smooth_operations as string} />
          <Field label="難しかった内容" value={cf.difficulties as string} />
          <Field label="自己解決できたこと" value={cf.self_solved as string} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">気づき</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="気づき" value={cf.awareness as string} />
          <Field label="次回の重点項目" value={cf.tomorrow_focus as string} />
          <Field label="質問事項" value={cf.questions as string} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">コンディション</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">集中度</p>
            <Stars level={cf.concentration_level as number | undefined} />
          </div>
          <Field label="体調メモ" value={cf.condition_comment as string} />
        </CardContent>
      </Card>
    </>
  )
}

function OutboundContent({ cf }: { cf: Record<string, unknown> }) {
  const calls = Number(cf.daily_call_count_actual ?? 0)
  const contacts = Number(cf.daily_contact_count ?? 0)
  const appointments = Number(cf.daily_appointment_count ?? 0)
  const { contactRate, appointmentRate } = calcOutboundRates(calls, contacts, appointments)

  const hasOptional =
    (cf.appointment_patterns && String(cf.appointment_patterns).trim()) ||
    (cf.rejection_patterns && String(cf.rejection_patterns).trim())

  const hasCondition = cf.condition && String(cf.condition).trim()

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="日付" value={cf.report_date as string} />
          <Field label="PJ名" value={cf.project_name as string} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">KPI実績</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">指標</th>
                  <th className="py-2 pr-4 text-right">目標</th>
                  <th className="py-2 pr-4 text-right">実績</th>
                  <th className="py-2 text-right">率</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 pr-4">架電数</td>
                  <td className="py-2 pr-4 text-right">{Number(cf.daily_call_count_target ?? 0)}</td>
                  <td className="py-2 pr-4 text-right font-medium">{calls}</td>
                  <td className="py-2 text-right">—</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">通電数</td>
                  <td className="py-2 pr-4 text-right">—</td>
                  <td className="py-2 pr-4 text-right font-medium">{contacts}</td>
                  <td className="py-2 text-right">{contactRate}%</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">アポ数</td>
                  <td className="py-2 pr-4 text-right">—</td>
                  <td className="py-2 pr-4 text-right font-medium">{appointments}</td>
                  <td className="py-2 text-right">{appointmentRate}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">行動の質</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="自己評価" value={cf.self_evaluation as string} />
          <Field label="トークの工夫" value={cf.talk_improvements as string} />
        </CardContent>
      </Card>

      {hasOptional && (
        <Card>
          <CardHeader><CardTitle className="text-base">任意記入</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="アポ獲得パターン" value={cf.appointment_patterns as string} />
            <Field label="断りパターン" value={cf.rejection_patterns as string} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">改善・次アクション</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="次回の架電目標" value={cf.tomorrow_call_target as number} />
          <Field label="次回のアポ目標" value={cf.tomorrow_appointment_target as number} />
          <Field label="改善アクション" value={cf.tomorrow_improvement as string} />
          <Field label="エスカレーション事項" value={cf.escalation_items as string} />
        </CardContent>
      </Card>

      {hasCondition && (
        <Card>
          <CardHeader><CardTitle className="text-base">コンディション</CardTitle></CardHeader>
          <CardContent>
            <Field label="体調メモ" value={cf.condition as string} />
          </CardContent>
        </Card>
      )}
    </>
  )
}

function InboundContent({ cf }: { cf: Record<string, unknown> }) {
  const received = Number(cf.daily_received_count ?? 0)
  const completed = Number(cf.daily_completed_count ?? 0)
  const escalations = Number(cf.daily_escalation_count ?? 0)
  const { completionRate } = calcInboundRates(received, completed)

  const hasOptional =
    (cf.common_inquiries && String(cf.common_inquiries).trim()) ||
    (cf.difficult_cases && String(cf.difficult_cases).trim())

  const hasCondition = cf.condition && String(cf.condition).trim()

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="日付" value={cf.report_date as string} />
          <Field label="PJ名" value={cf.project_name as string} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">KPI実績</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">受電数</p>
              <p className="text-lg font-medium">{received}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">対応完了数</p>
              <p className="text-lg font-medium">{completed}</p>
              <p className="text-xs text-muted-foreground">完了率: {completionRate}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">エスカレーション</p>
              <p className="text-lg font-medium">{escalations}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">平均対応時間</p>
              <p className="text-lg font-medium">
                {cf.daily_avg_handle_time ? `${cf.daily_avg_handle_time}分` : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">行動の質</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="自己評価" value={cf.self_evaluation as string} />
          <Field label="工夫した点" value={cf.improvements as string} />
        </CardContent>
      </Card>

      {hasOptional && (
        <Card>
          <CardHeader><CardTitle className="text-base">任意記入</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="よくある問い合わせ" value={cf.common_inquiries as string} />
            <Field label="対応が難しかったケース" value={cf.difficult_cases as string} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">改善・次アクション</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="改善アクション" value={cf.tomorrow_improvement as string} />
          <Field label="エスカレーション事項" value={cf.escalation_items as string} />
        </CardContent>
      </Card>

      {hasCondition && (
        <Card>
          <CardHeader><CardTitle className="text-base">コンディション</CardTitle></CardHeader>
          <CardContent>
            <Field label="体調メモ" value={cf.condition as string} />
          </CardContent>
        </Card>
      )}
    </>
  )
}

function LeonIsContent({ cf }: { cf: Record<string, unknown> }) {
  const slackNotified = Number(cf.slack_notified_count ?? 0)
  const immediate = Number(cf.immediate_call_count ?? 0)
  const followup = Number(cf.followup_call_count ?? 0)
  const received = Number(cf.received_call_count ?? 0)
  const contract = Number(cf.contract_zoom_count ?? 0)

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="日付" value={cf.report_date as string} />
          <Field label="PJ名" value={cf.project_name as string} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">定量</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Slack通知対象数</p>
              <p className="text-lg font-medium">{slackNotified}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">即時架電数</p>
              <p className="text-lg font-medium">{immediate}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">通常架電数</p>
              <p className="text-lg font-medium">{followup}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">受電数</p>
              <p className="text-lg font-medium">{received}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">契約入金/伴走(Zoom)</p>
              <p className="text-lg font-medium">{contract}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">定性</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="自己評価" value={cf.self_evaluation as string} />
          <Field label="現状の課題" value={cf.current_issues as string} />
          <Field label="課題に対しての改善" value={cf.issue_improvements as string} />
          <Field label="困っていること・相談事" value={cf.consultations as string} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">コンディション</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">集中度</p>
            <Stars level={cf.concentration_level as number | undefined} />
          </div>
          <Field label="体調メモ" value={cf.condition_comment as string} />
        </CardContent>
      </Card>
    </>
  )
}

// ---------- main page ----------

export default function DailyReportDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data: report, isLoading } = useDailyReport(id)
  const approveMutation = useApproveDailyReport(id)
  const deleteMutation = useDeleteDailyReport()

  const handleDelete = async () => {
    if (typeof window !== 'undefined' && !window.confirm('この日報を削除しますか？')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('日報を削除しました')
      router.push('/reports/work')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  const [approvalComment, setApprovalComment] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        setIsAdmin(['owner', 'admin'].includes(data.role))
      })
      .catch(() => {})
  }, [])

  const handleApprove = async (newStatus: 'approved' | 'rejected') => {
    if (!approvalComment.trim()) {
      toast.error(
        newStatus === 'rejected'
          ? '差戻し理由を入力してください'
          : '承認コメントを入力してください'
      )
      return
    }
    try {
      await approveMutation.mutateAsync({
        status: newStatus,
        comment: approvalComment,
      })
      toast.success(newStatus === 'approved' ? '承認しました' : '差戻ししました')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : '処理に失敗しました'
      )
    }
  }

  // ---------- loading / not-found ----------

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="form" rows={8} />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        日報が見つかりません
      </div>
    )
  }

  // ---------- derived ----------

  const cf = (report.custom_fields ?? {}) as Record<string, unknown>
  const reportType = report.report_type as DailyReportType
  const isApproving = approveMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="日報詳細"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/reports/work')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              一覧に戻る
            </Button>
            {report.status !== 'approved' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/reports/work/${id}/edit`)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                修正
              </Button>
            )}
            {report.status !== 'approved' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                削除
              </Button>
            )}
          </div>
        }
      />

      {/* Top info bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground mr-1">日付:</span>
              <span className="font-medium">
                {(cf.report_date as string) ?? '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground mr-1">スタッフ:</span>
              <span className="font-medium">
                {report.staff_name ??
                  (report.staff
                    ? `${report.staff.last_name} ${report.staff.first_name}`
                    : '—')}
              </span>
            </div>
            {typeBadge(reportType)}
            {statusBadge(report.status)}
          </div>
        </CardContent>
      </Card>

      {/* Report body */}
      {reportType === 'training' && <TrainingContent cf={cf} />}
      {reportType === 'outbound' && (
        <OutboundContent
          cf={{ ...cf, project_name: report.project_name ?? report.project?.name }}
        />
      )}
      {reportType === 'inbound' && (
        <InboundContent
          cf={{ ...cf, project_name: report.project_name ?? report.project?.name }}
        />
      )}
      {reportType === 'leon_is' && (
        <LeonIsContent
          cf={{ ...cf, project_name: report.project_name ?? report.project?.name }}
        />
      )}

      {/* Timestamps */}
      <Card>
        <CardContent className="py-4 space-y-2">
          <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
            {report.submitted_at && (
              <span>
                提出日: {new Date(report.submitted_at).toLocaleString('ja-JP')}
              </span>
            )}
            {report.approved_at && (
              <span>
                {report.status === 'rejected' ? '差戻し日' : '承認日'}:{' '}
                {new Date(report.approved_at).toLocaleString('ja-JP')}
              </span>
            )}
            <span>
              作成日: {new Date(report.created_at).toLocaleString('ja-JP')}
            </span>
            <span>
              更新日: {new Date(report.updated_at).toLocaleString('ja-JP')}
            </span>
          </div>
          {(report.status === 'approved' || report.status === 'rejected') &&
            (report as unknown as { approval_comment?: string | null }).approval_comment && (
              <div className="text-xs">
                <span className="text-muted-foreground">
                  {report.status === 'rejected' ? '差戻しコメント' : '承認コメント'}:
                </span>{' '}
                <span className="whitespace-pre-wrap">
                  {(report as unknown as { approval_comment?: string | null }).approval_comment}
                </span>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Approval section — admin only, submitted reports */}
      {report.status === 'submitted' && isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">承認・差戻し</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="コメント（必須）"
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              rows={3}
              required
            />
            <p className="text-xs text-muted-foreground">
              承認・差戻しどちらの場合もコメントの入力が必須です
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => handleApprove('approved')}
                disabled={isApproving}
                className="bg-green-600 hover:bg-green-700"
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                承認
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleApprove('rejected')}
                disabled={isApproving}
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-1" />
                )}
                差戻し
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
