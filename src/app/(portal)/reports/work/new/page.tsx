'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Send, Loader2, RefreshCw, Clock, AlertTriangle, CalendarPlus, Check, Pencil, RotateCcw } from 'lucide-react'

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

import { useCreateDailyReport, useMonthlyKpiTotals } from '@/hooks/use-daily-reports'
import { useProjects } from '@/hooks/use-projects'
import {
  type DailyReportType,
  DAILY_REPORT_TYPE_LABELS,
  calcOutboundRates,
} from '@/lib/validations/daily-report'

function getTodayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function NewDailyReportPage() {
  const router = useRouter()
  const createReport = useCreateDailyReport()
  const { data: projects = [] } = useProjects()
  const projectItems = Object.fromEntries(projects.map((p: { id: string; name: string }) => [p.id, p.name]))

  // --- Common state ---
  const [reportType, setReportType] = useState<DailyReportType>('outbound')
  const [reportDate, setReportDate] = useState(getTodayString())
  const [projectId, setProjectId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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
  const [isFetchingKpi, setIsFetchingKpi] = useState(false)

  const fetchCanviCallKpi = useCallback(async () => {
    if (!reportDate) {
      toast.error('日付を選択してください')
      return
    }
    if (!projectId) {
      toast.error('プロジェクトを選択してください')
      return
    }
    setIsFetchingKpi(true)
    try {
      const res = await fetch(`/api/integrations/canvi-call/kpi?date=${reportDate}&project_id=${projectId}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'データ取得に失敗しました')
      }
      const data = await res.json()
      setCallActual(String(data.totalCalls || 0))
      setContactCount(String(data.connected || 0))
      setAppointmentCount(String(data.apo || 0))
      toast.success(`テレアポくんから取得: 架電${data.totalCalls}件 / 通電${data.connected}件 / アポ${data.apo}件`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'テレアポくんとの連携に失敗しました')
    } finally {
      setIsFetchingKpi(false)
    }
  }, [reportDate, projectId])

  // --- シフト情報 & 架電数目標の自動計算 ---
  type ShiftInfo = {
    shiftHours: number
    shiftMinutes: number
    callsPerHour: number
    shifts: number
    shiftDetails: { id: string; startTime: string; endTime: string; status: string }[]
    isBpo: boolean
    projectName: string
    projectType: string
    hasShift: boolean
    staffId: string
  }
  const [shiftInfo, setShiftInfo] = useState<ShiftInfo | null>(null)
  const [breakMinutes, setBreakMinutes] = useState(0)
  const [shiftConfirmed, setShiftConfirmed] = useState(false)
  const [isEditingShift, setIsEditingShift] = useState(false)
  const [editShiftStart, setEditShiftStart] = useState('')
  const [editShiftEnd, setEditShiftEnd] = useState('')
  const [isUpdatingShift, setIsUpdatingShift] = useState(false)
  const [isCreatingShift, setIsCreatingShift] = useState(false)
  const [newShiftStart, setNewShiftStart] = useState('09:00')
  const [newShiftEnd, setNewShiftEnd] = useState('18:00')

  useEffect(() => {
    if (!reportDate || !projectId) {
      setShiftInfo(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/reports/call-target?date=${reportDate}&project_id=${projectId}`
        )
        if (!res.ok || cancelled) return
        const data: ShiftInfo = await res.json()
        if (cancelled) return
        setShiftInfo(data)
        setBreakMinutes(0)
        setShiftConfirmed(false)
        setIsEditingShift(false)
      } catch {
        // silently ignore
      }
    })()
    return () => { cancelled = true }
  }, [reportType, reportDate, projectId])

  // 休憩時間を考慮した架電数目標の自動計算
  useEffect(() => {
    if (!shiftInfo?.hasShift || !shiftInfo.isBpo) return
    const effectiveMinutes = shiftInfo.shiftMinutes - breakMinutes
    if (effectiveMinutes <= 0) {
      setCallTarget('0')
      return
    }
    const effectiveHours = effectiveMinutes / 60
    setCallTarget(String(Math.ceil(effectiveHours * shiftInfo.callsPerHour)))
  }, [shiftInfo, breakMinutes])

  const handleCreateShift = useCallback(async (startTime: string, endTime: string) => {
    if (!shiftInfo?.staffId || !projectId || !reportDate) return
    setIsCreatingShift(true)
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: shiftInfo.staffId,
          project_id: projectId,
          shift_date: reportDate,
          start_time: startTime,
          end_time: endTime,
          shift_type: 'WORK',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'シフト登録に失敗しました')
      }
      toast.success('シフトを登録しました')
      // リフェッチ（callTargetはuseEffectで自動計算される）
      const r2 = await fetch(`/api/reports/call-target?date=${reportDate}&project_id=${projectId}`)
      if (r2.ok) {
        const data: ShiftInfo = await r2.json()
        setShiftInfo(data)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'シフト登録に失敗しました')
    } finally {
      setIsCreatingShift(false)
    }
  }, [shiftInfo?.staffId, projectId, reportDate])

  // シフト修正（既存シフトの時間を更新）
  const handleUpdateShift = useCallback(async () => {
    if (!shiftInfo?.shiftDetails?.[0]?.id || !editShiftStart || !editShiftEnd) return
    setIsUpdatingShift(true)
    try {
      const shiftId = shiftInfo.shiftDetails[0].id
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _inlineUpdate: true,
          start_time: editShiftStart,
          end_time: editShiftEnd,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'シフト修正に失敗しました')
      }
      toast.success('シフトを修正しました')
      // リフェッチ
      const r2 = await fetch(`/api/reports/call-target?date=${reportDate}&project_id=${projectId}`)
      if (r2.ok) {
        const data: ShiftInfo = await r2.json()
        setShiftInfo(data)
      }
      setIsEditingShift(false)
      setShiftConfirmed(true)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'シフト修正に失敗しました')
    } finally {
      setIsUpdatingShift(false)
    }
  }, [shiftInfo, editShiftStart, editShiftEnd, reportDate, projectId])

  // シフトを再取得
  const handleRefetchShift = useCallback(async () => {
    if (!reportDate || !projectId) return
    try {
      const res = await fetch(`/api/reports/call-target?date=${reportDate}&project_id=${projectId}`)
      if (res.ok) {
        const data: ShiftInfo = await res.json()
        setShiftInfo(data)
        setShiftConfirmed(false)
        setIsEditingShift(false)
        setBreakMinutes(0)
        toast.success('シフト情報を再取得しました')
      }
    } catch {
      toast.error('シフト再取得に失敗しました')
    }
  }, [reportDate, projectId])

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

  // --- Leon IS state ---
  const [leonSlackNotifiedCount, setLeonSlackNotifiedCount] = useState('')
  const [leonImmediateCallCount, setLeonImmediateCallCount] = useState('')
  const [leonFollowupCallCount, setLeonFollowupCallCount] = useState('')
  const [leonReceivedCallCount, setLeonReceivedCallCount] = useState('')
  const [leonContractZoomCount, setLeonContractZoomCount] = useState('')
  const [leonSelfEvaluation, setLeonSelfEvaluation] = useState('')
  const [leonCurrentIssues, setLeonCurrentIssues] = useState('')
  const [leonIssueImprovements, setLeonIssueImprovements] = useState('')
  const [leonConsultations, setLeonConsultations] = useState('')

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
  const handleSubmit = async (asDraft = false) => {
    // シフトがある場合、シフト確認必須（全報告タイプ共通）
    if (shiftInfo?.hasShift && !shiftConfirmed && !asDraft) {
      toast.error('シフト情報を確認してください。「このシフトで報告する」または「修正する」を選択してください。')
      return
    }
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
          concentration_level: concentrationLevel,
          condition_comment: conditionComment,
        }
      } else if (reportType === 'inbound') {
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
          concentration_level: concentrationLevel,
          condition_comment: conditionComment,
        }
      } else {
        data = {
          report_type: 'leon_is',
          report_date: reportDate,
          project_id: projectId,
          slack_notified_count: Number(leonSlackNotifiedCount) || 0,
          immediate_call_count: Number(leonImmediateCallCount) || 0,
          followup_call_count: Number(leonFollowupCallCount) || 0,
          received_call_count: Number(leonReceivedCallCount) || 0,
          contract_zoom_count: Number(leonContractZoomCount) || 0,
          self_evaluation: leonSelfEvaluation,
          current_issues: leonCurrentIssues,
          issue_improvements: leonIssueImprovements,
          consultations: leonConsultations,
          concentration_level: concentrationLevel,
          condition_comment: conditionComment,
        }
      }
      await createReport.mutateAsync({ ...data, asDraft })
      toast.success(asDraft ? '下書きを保存しました' : '日報を提出しました')
      router.push('/reports/work')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- Render helpers ---
  const renderRequiredMark = () => (
    <span className="text-destructive">*</span>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="日報作成"
        description="日々の業務報告を作成・提出します"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/reports/work')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            一覧に戻る
          </Button>
        }
      />

      {/* Report type selector */}
      <div className="flex gap-2">
        {(['training', 'outbound', 'inbound', 'leon_is'] as const).map((type) => (
          <Button
            key={type}
            variant={reportType === type ? 'default' : 'outline'}
            onClick={() => setReportType(type)}
          >
            {DAILY_REPORT_TYPE_LABELS[type]}
          </Button>
        ))}
      </div>

      {/* ===== 共通: 基本情報（日付・プロジェクト・シフト確認） ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">&#9733; 基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="common-date">日付 {renderRequiredMark()}</Label>
            <Input
              id="common-date"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-[200px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label>プロジェクト {reportType !== 'training' && renderRequiredMark()}</Label>
            <Select value={projectId} onValueChange={setProjectId} items={projectItems}>
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
          {reportType === 'training' && (
            <div className="space-y-1.5">
              <Label htmlFor="study-theme">本日の自習テーマ {renderRequiredMark()}</Label>
              <Input
                id="study-theme"
                value={studyTheme}
                onChange={(e) => setStudyTheme(e.target.value)}
                placeholder="例: CRM操作研修、商品知識の復習"
              />
            </div>
          )}

          {/* シフト情報表示 + 確認/修正フロー（全報告タイプ共通） */}
          {projectId && shiftInfo && (
            <div className={`rounded-lg border p-3 space-y-2 ${shiftInfo.hasShift && !shiftConfirmed ? 'border-amber-300 bg-amber-50/30' : shiftConfirmed ? 'border-green-300 bg-green-50/30' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4 text-blue-500" />
                  当日のシフト
                  {shiftConfirmed && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1">
                      <Check className="h-3 w-3" /> 確認済
                    </span>
                  )}
                </div>
                {shiftInfo.hasShift && shiftConfirmed && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRefetchShift}
                    className="text-xs gap-1 h-7"
                  >
                    <RotateCcw className="h-3 w-3" />
                    シフトを再取得
                  </Button>
                )}
              </div>
              {shiftInfo.hasShift ? (
                <div className="text-sm text-muted-foreground space-y-2">
                  {shiftInfo.shiftDetails.map((s, i) => (
                    <div key={s.id || i} className="flex items-center gap-2">
                      <span className="font-mono">
                        {s.startTime?.slice(0, 5)} 〜 {s.endTime?.slice(0, 5)}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                        {s.status === 'APPROVED' ? '承認済' : '提出済'}
                      </span>
                    </div>
                  ))}
                  <div className="text-xs text-muted-foreground">
                    合計: {shiftInfo.shiftHours}時間
                  </div>

                  {/* 確認/修正ボタン（未確認時のみ表示） */}
                  {!shiftConfirmed && !isEditingShift && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setShiftConfirmed(true)}
                        className="text-xs gap-1.5 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-3.5 w-3.5" />
                        このシフトで報告する
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const first = shiftInfo.shiftDetails[0]
                          setEditShiftStart(first?.startTime?.slice(0, 5) || '09:00')
                          setEditShiftEnd(first?.endTime?.slice(0, 5) || '18:00')
                          setIsEditingShift(true)
                        }}
                        className="text-xs gap-1.5"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        修正する
                      </Button>
                    </div>
                  )}

                  {/* シフト修正フォーム */}
                  {isEditingShift && !shiftConfirmed && (
                    <div className="mt-2 pt-2 border-t space-y-2">
                      <div className="text-xs font-medium text-amber-700">正しい稼働時間を入力してください</div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={editShiftStart}
                          onChange={(e) => setEditShiftStart(e.target.value)}
                          className="w-[120px] h-8 text-sm"
                        />
                        <span className="text-sm text-muted-foreground">〜</span>
                        <Input
                          type="time"
                          value={editShiftEnd}
                          onChange={(e) => setEditShiftEnd(e.target.value)}
                          className="w-[120px] h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isUpdatingShift || !editShiftStart || !editShiftEnd}
                          onClick={handleUpdateShift}
                          className="text-xs gap-1.5"
                        >
                          {isUpdatingShift ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          この時間で確定
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingShift(false)}
                          className="text-xs"
                        >
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* 休憩時間入力（確認済みかつBPOの場合のみ） */}
                  {shiftConfirmed && shiftInfo.isBpo && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                      <Label className="text-xs whitespace-nowrap">休憩時間</Label>
                      <Input
                        type="number"
                        min="0"
                        max="120"
                        step="5"
                        value={breakMinutes || ''}
                        onChange={(e) => {
                          const v = Math.min(120, Math.max(0, Number(e.target.value) || 0))
                          setBreakMinutes(v)
                        }}
                        placeholder="0"
                        className="w-[80px] h-7 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">分</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    この日のシフトが登録されていません
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={newShiftStart}
                      onChange={(e) => setNewShiftStart(e.target.value)}
                      className="w-[120px] h-8 text-sm"
                    />
                    <span className="text-sm text-muted-foreground">〜</span>
                    <Input
                      type="time"
                      value={newShiftEnd}
                      onChange={(e) => setNewShiftEnd(e.target.value)}
                      className="w-[120px] h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isCreatingShift || !newShiftStart || !newShiftEnd}
                      onClick={() => handleCreateShift(newShiftStart, newShiftEnd)}
                      className="text-xs gap-1.5 whitespace-nowrap"
                    >
                      {isCreatingShift ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
                      シフトを登録
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Training Form ===== */}
      {reportType === 'training' && (
        <>

          {/* 理解度の自己申告 */}
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
                  placeholder="スムーズにできた操作や理解できた内容を記入"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>難しかった・わからなかったこと {renderRequiredMark()}</Label>
                <Textarea
                  value={difficultPoints}
                  onChange={(e) => setDifficultPoints(e.target.value)}
                  placeholder="難しかった点やわからなかったことを記入"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>自分で解決した方法</Label>
                <Textarea
                  value={selfSolution}
                  onChange={(e) => setSelfSolution(e.target.value)}
                  placeholder="自分で調べたり工夫して解決した方法があれば記入"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* 気づき・感想 */}
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
                  placeholder="自習を通じて気づいたことや感想を記入"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>次回の自習で重点的に取り組みたいこと {renderRequiredMark()}</Label>
                <Textarea
                  value={tomorrowStudyFocus}
                  onChange={(e) => setTomorrowStudyFocus(e.target.value)}
                  placeholder="次回取り組みたい内容を記入"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>上司・担当者への質問・確認事項</Label>
                <Textarea
                  value={questionsForSupervisor}
                  onChange={(e) => setQuestionsForSupervisor(e.target.value)}
                  placeholder="質問や確認したいことがあれば記入"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* コンディション */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; コンディション</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>集中度・理解度 {renderRequiredMark()}</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button
                      key={n}
                      size="sm"
                      variant={concentrationLevel === n ? 'default' : 'outline'}
                      onClick={() => setConcentrationLevel(n)}
                    >
                      {n}
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
                  placeholder="体調や気分など一言"
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== Outbound Form ===== */}
      {reportType === 'outbound' && (
        <>
          {/* KPI実績（当日） */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">&#9733; KPI実績（当日）</CardTitle>
                {shiftInfo?.isBpo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchCanviCallKpi}
                    disabled={isFetchingKpi}
                    className="text-xs gap-1.5"
                  >
                    {isFetchingKpi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    テレアポくんから取得
                  </Button>
                )}
              </div>
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
                    placeholder="0"
                  />
                  {shiftInfo && shiftInfo.isBpo && shiftInfo.hasShift && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {shiftInfo.projectName}: {(() => {
                        const effectiveMin = shiftInfo.shiftMinutes - breakMinutes
                        const effectiveH = Math.round((effectiveMin / 60) * 10) / 10
                        if (breakMinutes > 0) {
                          return `${shiftInfo.shiftHours}h - 休憩${breakMinutes}分 = ${effectiveH}h × ${shiftInfo.callsPerHour}件/h = ${callTarget}件`
                        }
                        return `${shiftInfo.shiftHours}h × ${shiftInfo.callsPerHour}件/h = ${callTarget}件`
                      })()}
                    </div>
                  )}
                  {shiftInfo && !shiftInfo.isBpo && projectId && (
                    <div className="text-xs text-muted-foreground mt-1">
                      BPO以外のプロジェクトのため自動計算対象外
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>架電数 実績 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={callActual}
                    onChange={(e) => setCallActual(e.target.value)}
                    placeholder="0"
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
                  placeholder="0"
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
                  placeholder="0"
                  className="w-[200px]"
                />
                <div className="text-sm text-muted-foreground mt-1">
                  アポ獲得率: {outboundRates.appointmentRate}%
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI実績（月累計） */}
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

          {/* 行動の質（定性） */}
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
                  placeholder="目標に対する達成度と、その要因を分析してください"
                  rows={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label>トークで工夫した点・変えた点 {renderRequiredMark()}</Label>
                <Textarea
                  value={talkImprovements}
                  onChange={(e) => setTalkImprovements(e.target.value)}
                  placeholder="トークスクリプトの改善や工夫した点を記入"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* 任意記入 */}
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
                  placeholder="アポが取れた案件に共通する特徴があれば記入"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>断られた際の主な理由・パターン</Label>
                <Textarea
                  value={rejectionPatterns}
                  onChange={(e) => setRejectionPatterns(e.target.value)}
                  placeholder="よくある断り文句やパターンがあれば記入"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* 改善・次アクション */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 改善・次アクション</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>次回の目標架電数 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tomorrowCallTarget}
                    onChange={(e) => setTomorrowCallTarget(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>次回のアポ目標 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={tomorrowAppointmentTarget}
                    onChange={(e) => setTomorrowAppointmentTarget(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>次回試す改善アクション {renderRequiredMark()}</Label>
                <Textarea
                  value={tomorrowImprovement}
                  onChange={(e) => setTomorrowImprovement(e.target.value)}
                  placeholder="次回取り組む具体的な改善アクションを記入"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>上司への相談・エスカレーション事項</Label>
                <Textarea
                  value={escalationNote}
                  onChange={(e) => setEscalationNote(e.target.value)}
                  placeholder="相談事項やエスカレーションがあれば記入"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* コンディション */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; コンディション</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>集中度・理解度 {renderRequiredMark()}</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button
                      key={n}
                      size="sm"
                      variant={concentrationLevel === n ? 'default' : 'outline'}
                      onClick={() => setConcentrationLevel(n)}
                    >
                      {n}
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
                  placeholder="体調や気分など一言"
                />
              </div>
              <div className="space-y-1.5">
                <Label>精神面・体調面で気になること</Label>
                <Textarea
                  value={outboundCondition}
                  onChange={(e) => setOutboundCondition(e.target.value)}
                  placeholder="体調や精神面で気になることがあれば記入"
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
          {/* KPI実績（当日） */}
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
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>対応完了数 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={completedCount}
                    onChange={(e) => setCompletedCount(e.target.value)}
                    placeholder="0"
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
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>平均対応時間（分）</Label>
                  <Input
                    type="number"
                    min="0"
                    value={avgHandlingTime}
                    onChange={(e) => setAvgHandlingTime(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI実績（月累計） */}
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

          {/* 行動の質（定性） */}
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
                  placeholder="今日の対応に対する自己評価と要因を分析してください"
                  rows={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label>対応で工夫した点 {renderRequiredMark()}</Label>
                <Textarea
                  value={inboundImprovements}
                  onChange={(e) => setInboundImprovements(e.target.value)}
                  placeholder="対応で工夫した点や改善した点を記入"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* 任意記入 */}
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
                  placeholder="今日多かった問い合わせの傾向を記入"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>対応に困ったケース</Label>
                <Textarea
                  value={difficultCases}
                  onChange={(e) => setDifficultCases(e.target.value)}
                  placeholder="対応に困ったケースがあれば記入"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* 改善・次アクション */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 改善・次アクション</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>次回試す改善アクション {renderRequiredMark()}</Label>
                <Textarea
                  value={inboundTomorrowImprovement}
                  onChange={(e) => setInboundTomorrowImprovement(e.target.value)}
                  placeholder="次回取り組む具体的な改善アクションを記入"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>上司への相談事項</Label>
                <Textarea
                  value={inboundEscalationNote}
                  onChange={(e) => setInboundEscalationNote(e.target.value)}
                  placeholder="相談事項があれば記入"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* コンディション */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; コンディション</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>集中度・理解度 {renderRequiredMark()}</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button
                      key={n}
                      size="sm"
                      variant={concentrationLevel === n ? 'default' : 'outline'}
                      onClick={() => setConcentrationLevel(n)}
                    >
                      {n}
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
                  placeholder="体調や気分など一言"
                />
              </div>
              <div className="space-y-1.5">
                <Label>精神面・体調面で気になること</Label>
                <Textarea
                  value={inboundCondition}
                  onChange={(e) => setInboundCondition(e.target.value)}
                  placeholder="体調や精神面で気になることがあれば記入"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== Leon IS Form ===== */}
      {reportType === 'leon_is' && (
        <>
          {/* 定量（当日） */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 定量（当日）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Slack通知された対象数 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={leonSlackNotifiedCount}
                    onChange={(e) => setLeonSlackNotifiedCount(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">広告から流入した予約数</p>
                </div>
                <div className="space-y-1.5">
                  <Label>即時架電数 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={leonImmediateCallCount}
                    onChange={(e) => setLeonImmediateCallCount(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">Slack通知→1分以内の架電</p>
                </div>
                <div className="space-y-1.5">
                  <Label>通常架電数 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={leonFollowupCallCount}
                    onChange={(e) => setLeonFollowupCallCount(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">即時架電数は含まない</p>
                </div>
                <div className="space-y-1.5">
                  <Label>受電数 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={leonReceivedCallCount}
                    onChange={(e) => setLeonReceivedCallCount(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">代表番号で電話を受けた数</p>
                </div>
                <div className="space-y-1.5">
                  <Label>契約入金および伴走 {renderRequiredMark()}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={leonContractZoomCount}
                    onChange={(e) => setLeonContractZoomCount(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">Zoomに入った数</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 定性 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; 定性</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>自己評価 {renderRequiredMark()}</Label>
                <Textarea
                  value={leonSelfEvaluation}
                  onChange={(e) => setLeonSelfEvaluation(e.target.value)}
                  placeholder="今日の業務に対する自己評価を記入"
                  rows={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label>現状の課題 {renderRequiredMark()}</Label>
                <Textarea
                  value={leonCurrentIssues}
                  onChange={(e) => setLeonCurrentIssues(e.target.value)}
                  placeholder="今抱えている課題を記入"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>課題に対しての改善 {renderRequiredMark()}</Label>
                <Textarea
                  value={leonIssueImprovements}
                  onChange={(e) => setLeonIssueImprovements(e.target.value)}
                  placeholder="課題に対する改善アクションを記入"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>困っていることや相談事</Label>
                <Textarea
                  value={leonConsultations}
                  onChange={(e) => setLeonConsultations(e.target.value)}
                  placeholder="相談したいことがあれば記入"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* コンディション */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">&#9733; コンディション</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>集中度・理解度 {renderRequiredMark()}</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button
                      key={n}
                      size="sm"
                      variant={concentrationLevel === n ? 'default' : 'outline'}
                      onClick={() => setConcentrationLevel(n)}
                    >
                      {n}
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
                  placeholder="体調や気分など一言"
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
          onClick={() => router.push('/reports/work')}
        >
          キャンセル
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting}
        >
          下書き保存
        </Button>
        <Button
          onClick={() => handleSubmit(false)}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-1" />
          )}
          {isSubmitting ? '提出中...' : '提出する'}
        </Button>
      </div>
    </div>
  )
}
