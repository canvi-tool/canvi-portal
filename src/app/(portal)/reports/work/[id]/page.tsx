'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Send,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { PageHeader } from '@/components/layout/page-header'
import { ShiftCrosscheckAlert } from '../../_components/shift-crosscheck-alert'
import { useWorkReport, useApproveWorkReport } from '@/hooks/use-reports'
import { REPORT_STATUS_LABELS } from '@/lib/constants'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  submitted: 'secondary',
  approved: 'default',
  rejected: 'destructive',
}

export default function WorkReportDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data: report, isLoading } = useWorkReport(id)
  const approveMutation = useApproveWorkReport(id)

  const [approvalComment, setApprovalComment] = useState('')
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({
        status: 'approved',
        comment: approvalComment,
      })
      toast.success('承認しました')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '承認に失敗しました')
    }
  }

  const handleReject = async () => {
    if (!approvalComment) {
      toast.error('差戻し理由を入力してください')
      return
    }
    try {
      await approveMutation.mutateAsync({
        status: 'rejected',
        comment: approvalComment,
      })
      toast.success('差戻ししました')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '差戻しに失敗しました')
    }
  }

  const handleSubmit = async () => {
    try {
      await approveMutation.mutateAsync({
        status: 'submitted' as 'approved',
        comment: '',
      })
      toast.success('提出しました')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '提出に失敗しました')
    }
  }

  const handleAiSummary = async () => {
    if (!report?.notes) {
      toast.error('定性報告がありません')
      return
    }

    setLoadingAi(true)
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: report.notes,
          context: `スタッフ: ${(report as { staff_name?: string }).staff_name || ''}, プロジェクト: ${(report as { project_name?: string }).project_name || ''}, 期間: ${report.year_month}`,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setAiSummary(data.summary)
      } else {
        toast.error('AI要約の生成に失敗しました')
      }
    } catch {
      toast.error('AI要約の生成に失敗しました')
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
        勤務報告が見つかりません
      </div>
    )
  }

  const shiftSummary = (report as { shift_summary?: { shift_days: number; shift_total_hours: number; hours_diff: number } }).shift_summary || null

  return (
    <div className="space-y-6">
      <PageHeader
        title={`勤務報告 - ${report.year_month}`}
        description={`${(report as { staff_name?: string }).staff_name || ''} / ${(report as { project_name?: string }).project_name || '未設定'}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[report.status] || 'outline'} className="text-sm">
              {REPORT_STATUS_LABELS[report.status] || report.status}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/reports/work')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              一覧に戻る
            </Button>
          </div>
        }
      />

      {/* Report details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">勤務情報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">勤務日数</p>
                <p className="font-medium text-lg">{report.working_days}日</p>
              </div>
              <div>
                <p className="text-muted-foreground">総勤務時間</p>
                <p className="font-medium text-lg">{report.total_hours}h</p>
              </div>
              <div>
                <p className="text-muted-foreground">残業時間</p>
                <p className="font-medium text-lg">{report.overtime_hours}h</p>
              </div>
              <div>
                <p className="text-muted-foreground">待機時間</p>
                <p className="font-medium text-lg">{report.standby_hours}h</p>
              </div>
              <div>
                <p className="text-muted-foreground">待機日数</p>
                <p className="font-medium text-lg">{report.standby_days}日</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shift cross-check */}
        <ShiftCrosscheckAlert
          shiftSummary={shiftSummary}
          reportedHours={report.total_hours}
          reportedDays={report.working_days}
        />
      </div>

      {/* Qualitative report */}
      {report.notes && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">定性報告 / 備考</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAiSummary}
              disabled={loadingAi}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              {loadingAi ? 'AI要約中...' : 'AI要約'}
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{report.notes}</p>

            {aiSummary && (
              <>
                <Separator className="my-4" />
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI要約
                  </p>
                  <p className="text-sm text-purple-900">{aiSummary}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timestamps */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
            {report.submitted_at && (
              <span>提出日: {new Date(report.submitted_at).toLocaleString('ja-JP')}</span>
            )}
            {report.approved_at && (
              <span>承認日: {new Date(report.approved_at).toLocaleString('ja-JP')}</span>
            )}
            <span>作成日: {new Date(report.created_at).toLocaleString('ja-JP')}</span>
            <span>更新日: {new Date(report.updated_at).toLocaleString('ja-JP')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {report.status === 'draft' && (
        <Card>
          <CardContent className="py-4">
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={approveMutation.isPending}>
                <Send className="h-4 w-4 mr-1" />
                提出する
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {report.status === 'submitted' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">承認ワークフロー</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>コメント</Label>
              <Textarea
                rows={3}
                placeholder="承認/差戻しコメント"
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={approveMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-1" />
                差戻し
              </Button>
              <Button onClick={handleApprove} disabled={approveMutation.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                承認
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
