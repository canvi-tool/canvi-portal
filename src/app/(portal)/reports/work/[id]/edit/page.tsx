'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'

import {
  useDailyReport,
  useUpdateDailyReport,
  useMonthlyKpiTotals,
} from '@/hooks/use-daily-reports'
import { useProjects } from '@/hooks/use-projects'
import {
  type DailyReportType,
  DAILY_REPORT_TYPE_LABELS,
  calcOutboundRates,
} from '@/lib/validations/daily-report'

export default function EditDailyReportPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data: report, isLoading } = useDailyReport(id)
  const updateReport = useUpdateDailyReport(id)
  const { data: projects = [] } = useProjects()

  // --- Common state ---
  const [reportType, setReportType] = useState<DailyReportType>('outbound')
  const [reportDate, setReportDate] = useState('')
  const [projectId, setProjectId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  // --- Training state ---
  const [studyTheme, setStudyTheme] = useState('')
  const [smoothOperations, setSmoothOperations] = useState('')
  const [difficultPoints, setDifficultPoints] = useState('')
  const [selfSolution, setSelfSolution] = useState('')
  const [studyInsight, setStudyInsight] = useState('')
  const [tomorrowStudyFocus, setTomorrowStudyFocus] = useState('')
  const [questionsForSupervisor, setQuestionsForSupervisor] = useState('')
  const [concentrationLevel, setConcentrationLevel] = useState<number>(0)
  const [conditionComment, setConditionComment] = useState('')

  // --- Outbound state ---
  const [callTarget, setCallTarget] = useState('')
  const [callActual, setCallActual] = useState('')
  const [contactCount, setContactCount] = useState('')
  const [appointmentCount, setAppointmentCount] = useState('')
  const [outboundSelfEvaluation, setOutboundSelfEvaluation] = useState('')
  const [talkImprovements, setTalkImprovements] = useState('')
  const [appointmentFeatures, setAppointmentFeatures] = useState('')
  const [rejectionPatterns, setRejectionPatterns] = useState('')
  const [tomorrowCallTarget, setTomorrowCallTarget] = useState('')
  const [tomorrowAppointmentTarget, setTomorrowAppointmentTarget] = useState('')
  const [tomorrowImprovement, setTomorrowImprovement] = useState('')
  const [escalationNote, setEscalationNote] = useState('')
  const [outboundCondition, setOutboundCondition] = useState('')

  // --- Inbound state ---
  const [incomingCount, setIncomingCount] = useState('')
  const [completedCount, setCompletedCount] = useState('')
  const [escalationCount, setEscalationCount] = useState('')
  const [avgHandlingTime, setAvgHandlingTime] = useState('')
  const [inboundSelfEvaluation, setInboundSelfEvaluation] = useState('')
  const [inboundImprovements, setInboundImprovements] = useState('')
  const [frequentInquiries, setFrequentInquiries] = useState('')
  const [difficultCases, setDifficultCases] = useState('')
  const [inboundTomorrowImprovement, setInboundTomorrowImprovement] = useState('')
  const [inboundEscalationNote, setInboundEscalationNote] = useState('')
  const [inboundCondition, setInboundCondition] = useState('')

  // Prefill from loaded report
  useEffect(() => {
    if (!report || prefilled) return
    const cf = (report.custom_fields ?? {}) as Record<string, unknown>
    const s = (k: string) => (cf[k] == null ? '' : String(cf[k]))
    const n = (k: string) => (cf[k] == null ? '' : String(cf[k]))

    setReportType(report.report_type as DailyReportType)
    setReportDate(
      (report.report_date as string) || (cf.report_date as string) || ''
    )
    setProjectId((report.project_id as string) || '')

    if (report.report_type === 'training') {
      setStudyTheme(s('study_theme'))
      setSmoothOperations(s('smooth_operations'))
      setDifficultPoints(s('difficulties'))
      setSelfSolution(s('self_solved'))
      setStudyInsight(s('awareness'))
      setTomorrowStudyFocus(s('tomorrow_focus'))
      setQuestionsForSupervisor(s('questions'))
      setConcentrationLevel(Number(cf.concentration_level) || 0)
      setConditionComment(s('condition_comment'))
    } else if (report.report_type === 'outbound') {
      setCallTarget(n('daily_call_count_target'))
      setCallActual(n('daily_call_count_actual'))
      setContactCount(n('daily_contact_count'))
      setAppointmentCount(n('daily_appointment_count'))
      setOutboundSelfEvaluation(s('self_evaluation'))
      setTalkImprovements(s('talk_improvements'))
      setAppointmentFeatures(s('appointment_patterns'))
      setRejectionPatterns(s('rejection_patterns'))
      setTomorrowCallTarget(n('tomorrow_call_target'))
      setTomorrowAppointmentTarget(n('tomorrow_appointment_target'))
      setTomorrowImprovement(s('tomorrow_improvement'))
      setEscalationNote(s('escalation_items'))
      setOutboundCondition(s('condition'))
    } else if (report.report_type === 'inbound') {
      setIncomingCount(n('daily_received_count'))
      setCompletedCount(n('daily_completed_count'))
      setEscalationCount(n('daily_escalation_count'))
      setAvgHandlingTime(n('daily_avg_handle_time'))
      setInboundSelfEvaluation(s('self_evaluation'))
      setInboundImprovements(s('improvements'))
      setFrequentInquiries(s('common_inquiries'))
      setDifficultCases(s('difficult_cases'))
      setInboundTomorrowImprovement(s('tomorrow_improvement'))
      setInboundEscalationNote(s('escalation_items'))
      setInboundCondition(s('condition'))
    }
    setPrefilled(true)
  }, [report, prefilled])

  // Guard: only draft/rejected can be edited
  useEffect(() => {
    if (!report) return
    if (report.status !== 'draft' && report.status !== 'rejected') {
      toast.error('提出済みまたは承認済みの日報は編集できません')
      router.replace(`/reports/work/${id}`)
    }
  }, [report, id, router])

  // --- Monthly KPI totals ---
  const yearMonth = reportDate ? reportDate.slice(0, 7) : ''
  const { data: monthlyTotals } = useMonthlyKpiTotals('', projectId, yearMonth)

  // --- Auto-calculated rates ---
  const outboundRates = calcOutboundRates(
    Number(callActual) || 0,
    Number(contactCount) || 0,
    Number(appointmentCount) || 0
  )

  // --- Submit ---
  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any
      if (reportType === 'training') {
        data = {
          report_type: 'training',
          report_date: reportDate,
          project_id: projectId || '',
          study_theme: studyTheme,
          smooth_operations: smoothOperations,
          difficulties: difficultPoints,
          self_solved: selfSolution,
          awareness: studyInsight,
          tomorrow_focus: tomorrowStudyFocus,
          questions: questionsForSupervisor,
          concentration_level: concentrationLevel,
          condition_comment: conditionComment,
        }
      } else if (reportType === 'outbound') {
        data = {
          report_type: 'outbound',
          report_date: reportDate,
          project_id: projectId,
          daily_call_count_target: Number(callTarget) || 0,
          daily_call_count_actual: Number(callActual) || 0,
          daily_contact_count: Number(contactCount) || 0,
          daily_appointment_count: Number(appointmentCount) || 0,
          self_evaluation: outboundSelfEvaluation,
          talk_improvements: talkImprovements,
          appointment_patterns: appointmentFeatures,
          rejection_patterns: rejectionPatterns,
          tomorrow_call_target: Number(tomorrowCallTarget) || 0,
          tomorrow_appointment_target: Number(tomorrowAppointmentTarget) || 0,
          tomorrow_improvement: tomorrowImprovement,
          escalation_items: escalationNote,
          condition: outboundCondition,
        }
      } else {
        data = {
          report_type: 'inbound',
          report_date: reportDate,
          project_id: projectId,
          daily_received_count: Number(incomingCount) || 0,
          daily_completed_count: Number(completedCount) || 0,
          daily_escalation_count: Number(escalationCount) || 0,
          daily_avg_handle_time: Number(avgHandlingTime) || 0,
          self_evaluation: inboundSelfEvaluation,
          improvements: inboundImprovements,
          common_inquiries: frequentInquiries,
          difficult_cases: difficultCases,
          tomorrow_improvement: inboundTomorrowImprovement,
          escalation_items: inboundEscalationNote,
          condition: inboundCondition,
        }
      }
      await updateReport.mutateAsync(data)
      toast.success('日報を更新しました')
      router.push(`/reports/work/${id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Render helpers ---
  const renderRequiredMark = () => (
    <span className="text-destructive">*</span>
  )

  if (isLoading || !report) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="form" rows={8} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="日報編集"
        description="日報を編集して再提出します"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/reports/work/${id}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            詳細に戻る
          </Button>
        }
      />

      {/* Report type selector */}
      <div className="flex gap-2">
        {(['training', 'outbound', 'inbound'] as const).map((type) => (
          <Button
            key={type}
            variant={reportType === type ? 'default' : 'outline'}
            onClick={() => setReportType(type)}
          >
            {DAILY_REPORT_TYPE_LABELS[type]}
          </Button>
        ))}
      </div>

      {/* ===== Training Form ===== */}
      {reportType === 'training' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="training-date">日付 {renderRequiredMark()}</Label>
                <Input
                  id="training-date"
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-[200px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="study-theme">本日の自習テーマ {renderRequiredMark()}</Label>
                <Input
                  id="study-theme"
                  value={studyTheme}
                  onChange={(e) => setStudyTheme(e.target.value)}
                  placeholder="例: CRM操作研修、商品知識の復習"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 理解度の自己申告</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>スムーズにできた操作・内容 {renderRequiredMark()}</Label>
                <Textarea
                  value={smoothOperations}
                  onChange={(e) => setSmoothOperations(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>難しかった・わからなかったこと {renderRequiredMark()}</Label>
                <Textarea
                  value={difficultPoints}
                  onChange={(e) => setDifficultPoints(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>自分で解決した方法</Label>
                <Textarea
                  value={selfSolution}
                  onChange={(e) => setSelfSolution(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 気づき・感想</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>今日の自習を通じて気づいたこと {renderRequiredMark()}</Label>
                <Textarea
                  value={studyInsight}
                  onChange={(e) => setStudyInsight(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>明日の自習で重点的に取り組みたいこと {renderRequiredMark()}</Label>
                <Textarea
                  value={tomorrowStudyFocus}
                  onChange={(e) => setTomorrowStudyFocus(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>上司・担当者への質問・確認事項</Label>
                <Textarea
                  value={questionsForSupervisor}
                  onChange={(e) => setQuestionsForSupervisor(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; コンディション</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>集中度・理解度 {renderRequiredMark()}</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((nn) => (
                    <Button
                      key={nn}
                      size="sm"
                      variant={concentrationLevel === nn ? 'default' : 'outline'}
                      onClick={() => setConcentrationLevel(nn)}
                    >
                      {nn}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">1: 低い ～ 5: 高い</p>
              </div>
              <div className="space-y-1.5">
                <Label>一言コメント</Label>
                <Input
                  value={conditionComment}
                  onChange={(e) => setConditionComment(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== Outbound Form ===== */}
      {reportType === 'outbound' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="outbound-date">日付 {renderRequiredMark()}</Label>
                <Input
                  id="outbound-date"
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-[200px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label>プロジェクト {renderRequiredMark()}</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="プロジェクトを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p: { id: string; name: string }) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; KPI実績（当日）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>架電数 目標 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={callTarget}
                    onChange={(e) => setCallTarget(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>架電数 実績 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={callActual}
                    onChange={(e) => setCallActual(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>担当者通電数 {renderRequiredMark()}</Label>
                <Input
                  type="number"
                  min="0"
                  value={contactCount}
                  onChange={(e) => setContactCount(e.target.value)}
                  className="w-[200px]"
                />
                <div className="text-sm text-muted-foreground mt-1">
                  担当者通電率: {outboundRates.contactRate}%
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>アポ獲得数 {renderRequiredMark()}</Label>
                <Input
                  type="number"
                  min="0"
                  value={appointmentCount}
                  onChange={(e) => setAppointmentCount(e.target.value)}
                  className="w-[200px]"
                />
                <div className="text-sm text-muted-foreground mt-1">
                  アポ獲得率: {outboundRates.appointmentRate}%
                </div>
              </div>
            </CardContent>
          </Card>

          {monthlyTotals && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">&#9733; KPI実績（月累計）</CardTitle>
                <CardDescription>当月の累計値（自動取得）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">総架電数</p>
                    <p className="text-xl font-bold">{monthlyTotals.total_calls ?? '-'}</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">総通電数</p>
                    <p className="text-xl font-bold">{monthlyTotals.total_contacts ?? '-'}</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">総通電率</p>
                    <p className="text-xl font-bold">{monthlyTotals.total_calls > 0 ? Math.round((monthlyTotals.total_contacts / monthlyTotals.total_calls) * 1000) / 10 : '-'}%</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">総アポ数</p>
                    <p className="text-xl font-bold">{monthlyTotals.total_appointments ?? '-'}</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">総アポ率</p>
                    <p className="text-xl font-bold">{monthlyTotals.total_calls > 0 ? Math.round((monthlyTotals.total_appointments / monthlyTotals.total_calls) * 1000) / 10 : '-'}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 行動の質（定性）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>今日のKPIに対する自己評価と要因分析 {renderRequiredMark()}</Label>
                <Textarea
                  value={outboundSelfEvaluation}
                  onChange={(e) => setOutboundSelfEvaluation(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label>トークで工夫した点・変えた点 {renderRequiredMark()}</Label>
                <Textarea
                  value={talkImprovements}
                  onChange={(e) => setTalkImprovements(e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 任意記入</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>アポ獲得できた案件の特徴・共通点</Label>
                <Textarea
                  value={appointmentFeatures}
                  onChange={(e) => setAppointmentFeatures(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>断られた際の主な理由・パターン</Label>
                <Textarea
                  value={rejectionPatterns}
                  onChange={(e) => setRejectionPatterns(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 改善・次アクション</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>明日の目標架電数 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tomorrowCallTarget}
                    onChange={(e) => setTomorrowCallTarget(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>明日のアポ目標 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tomorrowAppointmentTarget}
                    onChange={(e) => setTomorrowAppointmentTarget(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>明日試す改善アクション {renderRequiredMark()}</Label>
                <Textarea
                  value={tomorrowImprovement}
                  onChange={(e) => setTomorrowImprovement(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>上司への相談・エスカレーション事項</Label>
                <Textarea
                  value={escalationNote}
                  onChange={(e) => setEscalationNote(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; コンディション</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>精神面・体調面で気になること</Label>
                <Textarea
                  value={outboundCondition}
                  onChange={(e) => setOutboundCondition(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== Inbound Form ===== */}
      {reportType === 'inbound' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="inbound-date">日付 {renderRequiredMark()}</Label>
                <Input
                  id="inbound-date"
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-[200px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label>プロジェクト {renderRequiredMark()}</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="プロジェクトを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p: { id: string; name: string }) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; KPI実績（当日）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>受電数 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={incomingCount}
                    onChange={(e) => setIncomingCount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>対応完了数 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={completedCount}
                    onChange={(e) => setCompletedCount(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>エスカレーション数 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={escalationCount}
                    onChange={(e) => setEscalationCount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>平均対応時間（分）</Label>
                  <Input
                    type="number"
                    min="0"
                    value={avgHandlingTime}
                    onChange={(e) => setAvgHandlingTime(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {monthlyTotals && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">&#9733; KPI実績（月累計）</CardTitle>
                <CardDescription>当月の累計値（自動取得）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">総受電数</p>
                    <p className="text-xl font-bold">{monthlyTotals.total_received ?? '-'}</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">総対応完了数</p>
                    <p className="text-xl font-bold">{monthlyTotals.total_completed ?? '-'}</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">総エスカレーション数</p>
                    <p className="text-xl font-bold">{monthlyTotals.total_escalations ?? '-'}</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">完了率</p>
                    <p className="text-xl font-bold">{monthlyTotals.total_received > 0 ? Math.round((monthlyTotals.total_completed / monthlyTotals.total_received) * 1000) / 10 : '-'}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 行動の質（定性）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>自己評価と要因分析 {renderRequiredMark()}</Label>
                <Textarea
                  value={inboundSelfEvaluation}
                  onChange={(e) => setInboundSelfEvaluation(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label>対応で工夫した点 {renderRequiredMark()}</Label>
                <Textarea
                  value={inboundImprovements}
                  onChange={(e) => setInboundImprovements(e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 任意記入</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>多かった問い合わせ内容</Label>
                <Textarea
                  value={frequentInquiries}
                  onChange={(e) => setFrequentInquiries(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>対応に困ったケース</Label>
                <Textarea
                  value={difficultCases}
                  onChange={(e) => setDifficultCases(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 改善・次アクション</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>明日試す改善アクション {renderRequiredMark()}</Label>
                <Textarea
                  value={inboundTomorrowImprovement}
                  onChange={(e) => setInboundTomorrowImprovement(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>上司への相談事項</Label>
                <Textarea
                  value={inboundEscalationNote}
                  onChange={(e) => setInboundEscalationNote(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; コンディション</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>精神面・体調面で気になること</Label>
                <Textarea
                  value={inboundCondition}
                  onChange={(e) => setInboundCondition(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Submit button */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <Button
          variant="outline"
          onClick={() => router.push(`/reports/work/${id}`)}
        >
          キャンセル
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-1" />
          )}
          {isSubmitting ? '更新中...' : '更新して再提出'}
        </Button>
      </div>
    </div>
  )
}
