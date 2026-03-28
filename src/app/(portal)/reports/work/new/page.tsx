'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Play,
  Square,
  Coffee,
  CoffeeIcon,
  RefreshCw,
  Save,
  Send,
  Clock,
  Hash,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/layout/page-header'

// --- Demo Data ---

const DEMO_PROJECTS = [
  { id: 'pj-alpha', name: 'PJ-Alpha' },
  { id: 'pj-beta', name: 'PJ-Beta' },
  { id: 'pj-gamma', name: 'PJ-Gamma' },
]

const TODAY = '2026-03-28'
const CURRENT_USER = { id: '1', name: '田中太郎' }

// --- Types ---

type PunchStatus = 'idle' | 'working' | 'on_break' | 'finished'

type PunchLog = {
  type: 'work_start' | 'break_start' | 'break_end' | 'work_end'
  time: string
  label: string
}

type WorkType = 'punch' | 'hours'

type ProjectEntry = {
  id: string
  projectId: string
  workType: WorkType
  // 打刻
  punchStatus: PunchStatus
  punchLogs: PunchLog[]
  workStartTime: string | null
  workEndTime: string | null
  breakStartTime: string | null
  totalBreakSeconds: number
  // 時間入力
  totalHours: string
  // 実績
  callCount: string
  appointmentCount: string
  otherAchievements: string
  qualitativeNote: string
  deliverableUrl: string
  fetchingCalls: boolean
}

function createEmptyEntry(): ProjectEntry {
  return {
    id: crypto.randomUUID(),
    projectId: '',
    workType: 'punch',
    punchStatus: 'idle',
    punchLogs: [],
    workStartTime: null,
    workEndTime: null,
    breakStartTime: null,
    totalBreakSeconds: 0,
    totalHours: '',
    callCount: '',
    appointmentCount: '',
    otherAchievements: '',
    qualitativeNote: '',
    deliverableUrl: '',
    fetchingCalls: false,
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function calcWorkDuration(entry: ProjectEntry): string {
  if (!entry.workStartTime) return '--:--'
  const start = entry.workStartTime
  const end = entry.workEndTime || formatTimeShort(new Date())

  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const totalMinutes = (eh * 60 + em) - (sh * 60 + sm) - Math.floor(entry.totalBreakSeconds / 60)
  if (totalMinutes < 0) return '--:--'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}時間${m > 0 ? `${m}分` : ''}`
}

// --- Component ---

export default function NewWorkReportPage() {
  const router = useRouter()

  const [date, setDate] = useState(TODAY)
  const [isOtherDate, setIsOtherDate] = useState(false)
  const [otherDateReason, setOtherDateReason] = useState('')
  const [entries, setEntries] = useState<ProjectEntry[]>([createEmptyEntry()])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  // 現在時刻の更新（打刻表示用） - クライアントサイドのみ
  useEffect(() => {
    setIsMounted(true)
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const updateEntry = useCallback((id: string, updates: Partial<ProjectEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    )
  }, [])

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const addEntry = () => {
    setEntries((prev) => [...prev, createEmptyEntry()])
  }

  // --- 打刻処理 ---
  const handleWorkStart = (entryId: string) => {
    const now = new Date()
    const timeStr = formatTimeShort(now)
    updateEntry(entryId, {
      punchStatus: 'working',
      workStartTime: timeStr,
      punchLogs: [{
        type: 'work_start',
        time: formatTime(now),
        label: '業務開始',
      }],
    })
  }

  const handleBreakStart = (entryId: string, entry: ProjectEntry) => {
    const now = new Date()
    updateEntry(entryId, {
      punchStatus: 'on_break',
      breakStartTime: formatTime(now),
      punchLogs: [...entry.punchLogs, {
        type: 'break_start',
        time: formatTime(now),
        label: '休憩開始',
      }],
    })
  }

  const handleBreakEnd = (entryId: string, entry: ProjectEntry) => {
    const now = new Date()
    // 休憩時間を加算
    let additionalBreak = 0
    if (entry.breakStartTime) {
      const breakStart = new Date()
      const [bh, bm, bs] = entry.breakStartTime.split(':').map(Number)
      breakStart.setHours(bh, bm, bs, 0)
      additionalBreak = Math.floor((now.getTime() - breakStart.getTime()) / 1000)
    }
    updateEntry(entryId, {
      punchStatus: 'working',
      breakStartTime: null,
      totalBreakSeconds: entry.totalBreakSeconds + additionalBreak,
      punchLogs: [...entry.punchLogs, {
        type: 'break_end',
        time: formatTime(now),
        label: '休憩終了',
      }],
    })
  }

  const handleWorkEnd = (entryId: string, entry: ProjectEntry) => {
    const now = new Date()
    const timeStr = formatTimeShort(now)
    updateEntry(entryId, {
      punchStatus: 'finished',
      workEndTime: timeStr,
      punchLogs: [...entry.punchLogs, {
        type: 'work_end',
        time: formatTime(now),
        label: '業務終了',
      }],
    })
  }

  // API取得（架電件数 + アポ件数の両方を取得）
  const simulateApiFetch = (entryId: string) => {
    updateEntry(entryId, { fetchingCalls: true })
    setTimeout(() => {
      const callCount = Math.floor(Math.random() * 60) + 10
      const appointmentCount = Math.floor(Math.random() * 6) + 1
      updateEntry(entryId, {
        callCount: String(callCount),
        appointmentCount: String(appointmentCount),
        fetchingCalls: false,
      })
    }, 1200)
  }

  // 日付変更ハンドラ
  const handleDateChange = (newDate: string) => {
    setDate(newDate)
    if (newDate !== TODAY) {
      setIsOtherDate(true)
    } else {
      setIsOtherDate(false)
      setOtherDateReason('')
    }
  }

  const handleSubmit = (asDraft: boolean) => {
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      router.push('/reports/work')
    }, 800)
    void asDraft
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="日次勤務報告"
        description="打刻ボタンで業務時間を記録し、実績を報告します"
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

      {/* ユーザー情報 + 日付 + 現在時刻 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
                {CURRENT_USER.name.charAt(0)}
              </div>
              <div>
                <p className="text-lg font-semibold">{CURRENT_USER.name}</p>
                <p className="text-sm text-muted-foreground">ログインユーザー</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-3xl font-mono font-bold tabular-nums">
                  {isMounted && currentTime ? formatTime(currentTime) : '--:--:--'}
                </p>
                <p className="text-sm text-muted-foreground">現在時刻</p>
              </div>
            </div>
          </div>

          {/* 日付選択 */}
          <div className="mt-4 flex items-center gap-3">
            <div className="space-y-1">
              <Label htmlFor="report-date" className="text-xs text-muted-foreground">報告日</Label>
              <Input
                id="report-date"
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-[180px]"
              />
            </div>
            {date === TODAY && (
              <Badge variant="secondary" className="mt-5">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                本日
              </Badge>
            )}
          </div>

          {/* 他日程の場合は理由入力（管理者承認必須） */}
          {isOtherDate && (
            <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  当日以外の報告は管理者の承認が必要です
                </span>
              </div>
              <Textarea
                value={otherDateReason}
                onChange={(e) => setOtherDateReason(e.target.value)}
                placeholder="申請理由を入力してください（例：体調不良により前日分を翌日報告）"
                rows={2}
                className="bg-white dark:bg-slate-900"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* プロジェクト稼働セクション */}
      {entries.map((entry, idx) => (
        <Card key={entry.id} className="relative">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  プロジェクト稼働 #{idx + 1}
                </CardTitle>
                {entry.punchStatus !== 'idle' && (
                  <CardDescription className="mt-1">
                    稼働時間: {calcWorkDuration(entry)}
                    {entry.totalBreakSeconds > 0 && (
                      <span className="ml-2">(休憩: {Math.floor(entry.totalBreakSeconds / 60)}分)</span>
                    )}
                  </CardDescription>
                )}
              </div>
              {entries.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEntry(entry.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* プロジェクト選択 */}
            <div className="space-y-1.5">
              <Label>プロジェクト</Label>
              <Select
                value={entry.projectId}
                onValueChange={(v) => updateEntry(entry.id, { projectId: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="プロジェクトを選択" />
                </SelectTrigger>
                <SelectContent>
                  {DEMO_PROJECTS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 勤務タイプ選択 */}
            <div className="space-y-1.5">
              <Label>勤務タイプ</Label>
              <div className="flex gap-2">
                <Button
                  variant={entry.workType === 'punch' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateEntry(entry.id, { workType: 'punch' })}
                  disabled={entry.punchStatus !== 'idle'}
                >
                  <Clock className="h-3 w-3 mr-1" />
                  打刻
                </Button>
                <Button
                  variant={entry.workType === 'hours' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateEntry(entry.id, { workType: 'hours' })}
                  disabled={entry.punchStatus !== 'idle'}
                >
                  <Hash className="h-3 w-3 mr-1" />
                  時間入力
                </Button>
              </div>
            </div>

            {/* === 打刻モード === */}
            {entry.workType === 'punch' && (
              <div className="space-y-4">
                {/* 打刻ボタンエリア */}
                <div className="p-4 rounded-lg border-2 border-dashed bg-muted/30">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* 業務開始 */}
                    <Button
                      size="lg"
                      className="h-16 flex-col gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={entry.punchStatus !== 'idle'}
                      onClick={() => handleWorkStart(entry.id)}
                    >
                      <Play className="h-5 w-5" />
                      <span className="text-xs font-medium">業務開始</span>
                    </Button>

                    {/* 休憩開始 */}
                    <Button
                      size="lg"
                      className="h-16 flex-col gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                      disabled={entry.punchStatus !== 'working'}
                      onClick={() => handleBreakStart(entry.id, entry)}
                    >
                      <Coffee className="h-5 w-5" />
                      <span className="text-xs font-medium">休憩開始</span>
                    </Button>

                    {/* 休憩終了 */}
                    <Button
                      size="lg"
                      className="h-16 flex-col gap-1 bg-blue-500 hover:bg-blue-600 text-white"
                      disabled={entry.punchStatus !== 'on_break'}
                      onClick={() => handleBreakEnd(entry.id, entry)}
                    >
                      <CoffeeIcon className="h-5 w-5" />
                      <span className="text-xs font-medium">休憩終了</span>
                    </Button>

                    {/* 業務終了 */}
                    <Button
                      size="lg"
                      className="h-16 flex-col gap-1 bg-red-600 hover:bg-red-700 text-white"
                      disabled={entry.punchStatus !== 'working'}
                      onClick={() => handleWorkEnd(entry.id, entry)}
                    >
                      <Square className="h-5 w-5" />
                      <span className="text-xs font-medium">業務終了</span>
                    </Button>
                  </div>

                  {/* ステータス表示 */}
                  <div className="mt-3 flex items-center justify-center gap-2">
                    {entry.punchStatus === 'idle' && (
                      <Badge variant="outline" className="text-muted-foreground">
                        未開始
                      </Badge>
                    )}
                    {entry.punchStatus === 'working' && (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 animate-pulse">
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                        業務中
                      </Badge>
                    )}
                    {entry.punchStatus === 'on_break' && (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 animate-pulse">
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500" />
                        休憩中
                      </Badge>
                    )}
                    {entry.punchStatus === 'finished' && (
                      <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        業務終了
                      </Badge>
                    )}
                  </div>
                </div>

                {/* 打刻ログ */}
                {entry.punchLogs.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">打刻ログ</Label>
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
                      {entry.punchLogs.map((log, logIdx) => (
                        <div key={logIdx} className="flex items-center gap-3 text-sm">
                          <span className="font-mono text-xs text-muted-foreground w-[80px]">
                            {log.time}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              log.type === 'work_start' ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400' :
                              log.type === 'work_end' ? 'border-red-300 text-red-700 dark:text-red-400' :
                              log.type === 'break_start' ? 'border-amber-300 text-amber-700 dark:text-amber-400' :
                              'border-blue-300 text-blue-700 dark:text-blue-400'
                            }
                          >
                            {log.label}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 打刻サマリー */}
                {entry.workStartTime && (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg border p-2">
                      <p className="text-xs text-muted-foreground">開始</p>
                      <p className="text-lg font-mono font-semibold">{entry.workStartTime}</p>
                    </div>
                    <div className="rounded-lg border p-2">
                      <p className="text-xs text-muted-foreground">終了</p>
                      <p className="text-lg font-mono font-semibold">{entry.workEndTime || '--:--'}</p>
                    </div>
                    <div className="rounded-lg border p-2">
                      <p className="text-xs text-muted-foreground">稼働</p>
                      <p className="text-lg font-semibold">{calcWorkDuration(entry)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === 時間入力モード === */}
            {entry.workType === 'hours' && (
              <div className="space-y-1.5">
                <Label>合計稼働時間</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={entry.totalHours}
                    placeholder="例: 8"
                    onChange={(e) =>
                      updateEntry(entry.id, { totalHours: e.target.value })
                    }
                    className="w-[160px]"
                  />
                  <span className="text-sm text-muted-foreground">時間</span>
                </div>
              </div>
            )}

            {/* 区切り線 */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">実績報告</p>
            </div>

            {/* 架電件数 + アポ件数（API取得で両方入る） */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5 sm:col-span-1">
                <Label>架電件数</Label>
                <Input
                  type="number"
                  min="0"
                  value={entry.callCount}
                  placeholder="0"
                  onChange={(e) =>
                    updateEntry(entry.id, { callCount: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <Label>アポ件数</Label>
                <Input
                  type="number"
                  min="0"
                  value={entry.appointmentCount}
                  placeholder="0"
                  onChange={(e) =>
                    updateEntry(entry.id, { appointmentCount: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => simulateApiFetch(entry.id)}
                  disabled={entry.fetchingCalls || !entry.projectId}
                  className="w-full"
                >
                  <RefreshCw
                    className={`h-3 w-3 mr-1 ${entry.fetchingCalls ? 'animate-spin' : ''}`}
                  />
                  {entry.fetchingCalls ? '取得中...' : 'APIから実績取得'}
                </Button>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  架電・アポを一括取得
                </p>
              </div>
            </div>

            {/* その他成果 */}
            <div className="space-y-1.5">
              <Label>その他成果</Label>
              <Input
                value={entry.otherAchievements}
                placeholder="例: 見積書3件作成、社内MTG参加"
                onChange={(e) =>
                  updateEntry(entry.id, { otherAchievements: e.target.value })
                }
              />
            </div>

            {/* 定性報告 */}
            <div className="space-y-1.5">
              <Label>定性報告</Label>
              <Textarea
                value={entry.qualitativeNote}
                placeholder="業務内容、成果、課題、所感などを記入してください"
                rows={3}
                onChange={(e) =>
                  updateEntry(entry.id, { qualitativeNote: e.target.value })
                }
              />
            </div>

            {/* 成果物URL */}
            <div className="space-y-1.5">
              <Label>成果物URL（任意）</Label>
              <Input
                type="url"
                value={entry.deliverableUrl}
                placeholder="https://..."
                onChange={(e) =>
                  updateEntry(entry.id, { deliverableUrl: e.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* プロジェクト稼働追加 */}
      <Button variant="outline" className="w-full" onClick={addEntry}>
        <Plus className="h-4 w-4 mr-1" />
        プロジェクト稼働を追加
      </Button>

      {/* 提出 / 下書きボタン */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <Button
          variant="outline"
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting}
        >
          <Save className="h-4 w-4 mr-1" />
          下書き保存
        </Button>
        <Button
          onClick={() => handleSubmit(false)}
          disabled={isSubmitting || (isOtherDate && !otherDateReason.trim())}
        >
          <Send className="h-4 w-4 mr-1" />
          {isOtherDate ? '承認申請して提出' : '提出する'}
        </Button>
      </div>
    </div>
  )
}
