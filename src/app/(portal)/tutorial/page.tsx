'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  Circle,
  Clock,
  GraduationCap,
  Phone,
  BookOpen,
  Users,
  Coffee,
  MessageSquare,
  Gamepad2,
  Rocket,
  Trophy,
  Star,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

// --- Types ---
interface Task {
  id: string
  time: string
  title: string
  description: string
  icon: LucideIcon
  duration: string
  category: 'onboarding' | 'test' | 'training' | 'break' | 'work' | 'meeting'
}

interface DaySchedule {
  day: number
  title: string
  subtitle: string
  emoji: string
  color: string
  tasks: Task[]
}

// --- Constants (outside component) ---
const LEVEL_LABELS = ['未着手', '研修中', '後半戦', 'コンプリート!'] as const
const LEVEL_EMOJIS = ['🔰', '📖', '💪', '🏆'] as const

const SCHEDULE: DaySchedule[] = [
  {
    day: 1,
    title: '1日目',
    subtitle: 'オンボーディング & 基礎テスト',
    emoji: '🎓',
    color: 'from-blue-500 to-cyan-500',
    tasks: [
      {
        id: 'd1-1',
        time: '9:00〜11:00',
        title: 'オンボーディング',
        description: '会社概要、就業規則、ツールの使い方、Canviポータルの操作方法を学びます',
        icon: GraduationCap,
        duration: '2時間',
        category: 'onboarding',
      },
      {
        id: 'd1-2',
        time: '11:00〜12:00',
        title: 'MENTER テスト',
        description: 'ITリテラシーの基礎テストを受験します',
        icon: BookOpen,
        duration: '1時間',
        category: 'test',
      },
      {
        id: 'd1-3',
        time: '12:00〜13:00',
        title: '休憩',
        description: 'お昼休憩です。しっかり休んでください',
        icon: Coffee,
        duration: '1時間',
        category: 'break',
      },
      {
        id: 'd1-4',
        time: '13:00〜17:30',
        title: 'MENTER テスト + e-learning',
        description: 'テストの続きとe-learning教材での学習を進めます',
        icon: BookOpen,
        duration: '4.5時間',
        category: 'test',
      },
      {
        id: 'd1-5',
        time: '17:30〜18:00',
        title: '終礼',
        description: '1日の振り返りと翌日の予定を確認します',
        icon: MessageSquare,
        duration: '30分',
        category: 'meeting',
      },
    ],
  },
  {
    day: 2,
    title: '2日目',
    subtitle: 'e-learning & PJ研修',
    emoji: '📚',
    color: 'from-violet-500 to-purple-500',
    tasks: [
      {
        id: 'd2-1',
        time: '9:00〜9:30',
        title: '朝礼',
        description: 'チーム朝礼に参加します',
        icon: Users,
        duration: '30分',
        category: 'meeting',
      },
      {
        id: 'd2-2',
        time: '9:30〜12:00',
        title: 'MENTER e-learning',
        description: 'e-learning教材で業務に必要な知識を学習します',
        icon: BookOpen,
        duration: '2.5時間',
        category: 'test',
      },
      {
        id: 'd2-3',
        time: '12:00〜13:00',
        title: '休憩',
        description: 'お昼休憩です',
        icon: Coffee,
        duration: '1時間',
        category: 'break',
      },
      {
        id: 'd2-4',
        time: '13:00〜14:00',
        title: 'MENTER e-learning',
        description: 'e-learning教材の続きです',
        icon: BookOpen,
        duration: '1時間',
        category: 'test',
      },
      {
        id: 'd2-5',
        time: '14:00〜15:30',
        title: 'PJ研修（座学メイン）',
        description: 'アサインされたプロジェクトの概要、商材知識、トークスクリプトを学びます',
        icon: GraduationCap,
        duration: '1.5時間',
        category: 'training',
      },
      {
        id: 'd2-6',
        time: '15:30〜16:30',
        title: 'PJ自習 + ロープレ準備',
        description: '研修内容の復習とロールプレイングの準備をします',
        icon: Gamepad2,
        duration: '1時間',
        category: 'training',
      },
      {
        id: 'd2-7',
        time: '16:30〜17:30',
        title: 'PJ研修（ロープレメイン）',
        description: '実際の架電を想定したロールプレイング研修です。フィードバックを受けながら実践力を磨きます',
        icon: Phone,
        duration: '1時間',
        category: 'training',
      },
      {
        id: 'd2-8',
        time: '17:30〜18:00',
        title: '終礼',
        description: '2日間の研修の振り返りと翌日からの架電業務について確認します',
        icon: MessageSquare,
        duration: '30分',
        category: 'meeting',
      },
    ],
  },
  {
    day: 3,
    title: '3日目以降',
    subtitle: '架電業務スタート',
    emoji: '🚀',
    color: 'from-emerald-500 to-green-500',
    tasks: [
      {
        id: 'd3-1',
        time: '9:00〜9:30',
        title: '朝礼',
        description: 'チーム朝礼に参加します',
        icon: Users,
        duration: '30分',
        category: 'meeting',
      },
      {
        id: 'd3-2',
        time: '9:30〜10:00',
        title: '架電開始に向けての準備',
        description: 'リスト確認、トークスクリプト復習、架電ツールの起動\n※ロープレ研修が必要な場合はこの時間を使います',
        icon: Rocket,
        duration: '30分',
        category: 'work',
      },
      {
        id: 'd3-3',
        time: '10:00〜12:00',
        title: 'PJ架電（午前）',
        description: 'プロジェクトの架電業務を行います。不明点はすぐに質問してください',
        icon: Phone,
        duration: '2時間',
        category: 'work',
      },
      {
        id: 'd3-4',
        time: '12:00〜13:00',
        title: '休憩',
        description: 'お昼休憩です',
        icon: Coffee,
        duration: '1時間',
        category: 'break',
      },
      {
        id: 'd3-5',
        time: '13:00〜17:30',
        title: 'PJ架電（午後）',
        description: 'プロジェクトの架電業務を行います。目標件数を意識してがんばりましょう',
        icon: Phone,
        duration: '4.5時間',
        category: 'work',
      },
      {
        id: 'd3-6',
        time: '17:30〜17:45',
        title: '日報作成',
        description: '日次報告ページから今日の日報を提出します',
        icon: BookOpen,
        duration: '15分',
        category: 'work',
      },
      {
        id: 'd3-7',
        time: '17:45〜18:00',
        title: '終礼',
        description: '1日の振り返りと翌日の予定確認です',
        icon: MessageSquare,
        duration: '15分',
        category: 'meeting',
      },
    ],
  },
]

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  onboarding: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'オンボーディング' },
  test: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'テスト・学習' },
  training: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: '研修' },
  break: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: '休憩' },
  work: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', label: '実務' },
  meeting: { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-700 dark:text-slate-300', label: 'ミーティング' },
}

const STORAGE_KEY = 'canvi_tutorial_progress'

// --- Component ---
export default function TutorialPage() {
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]))
  const [mounted, setMounted] = useState(false)

  // Load from localStorage (with validation)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.every((v: unknown) => typeof v === 'string')) {
          setCompletedTasks(new Set(parsed as string[]))
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    } catch {
      try { localStorage.removeItem(STORAGE_KEY) } catch {}
    }
    setMounted(true)
  }, [])

  // Save to localStorage (with error handling)
  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...completedTasks]))
    } catch {
      // Storage full or unavailable
    }
  }, [completedTasks, mounted])

  const toggleTask = useCallback((taskId: string) => {
    setCompletedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }, [])

  const toggleDay = useCallback((day: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) {
        next.delete(day)
      } else {
        next.add(day)
      }
      return next
    })
  }, [])

  const resetProgress = useCallback(() => {
    if (!window.confirm('進捗をリセットしますか？この操作は元に戻せません。')) return
    setCompletedTasks(new Set())
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  // Overall stats (memoized)
  const { totalTasks, completedCount, overallProgress } = useMemo(() => {
    const total = SCHEDULE.reduce((sum, d) => sum + d.tasks.length, 0)
    const done = completedTasks.size
    return {
      totalTasks: total,
      completedCount: done,
      overallProgress: total > 0 ? Math.round((done / total) * 100) : 0,
    }
  }, [completedTasks])

  // Per-day progress
  const dayProgress = useMemo(() => {
    return SCHEDULE.map((day) => {
      const completed = day.tasks.filter((t) => completedTasks.has(t.id)).length
      return {
        day: day.day,
        completed,
        total: day.tasks.length,
        percent: day.tasks.length > 0 ? Math.round((completed / day.tasks.length) * 100) : 0,
      }
    })
  }, [completedTasks])

  // Auto-expand the current active day (depends on completedTasks, not dayProgress)
  useEffect(() => {
    if (!mounted) return
    const firstIncomplete = SCHEDULE.find((day) =>
      day.tasks.some((t) => !completedTasks.has(t.id))
    )
    if (firstIncomplete) {
      setExpandedDays((prev) => {
        if (prev.has(firstIncomplete.day)) return prev
        return new Set([...prev, firstIncomplete.day])
      })
    }
  }, [mounted, completedTasks])

  // Achievement level
  const level = overallProgress === 100 ? 3 : overallProgress >= 50 ? 2 : overallProgress > 0 ? 1 : 0

  const handleTaskKeyDown = useCallback((e: React.KeyboardEvent, taskId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleTask(taskId)
    }
  }, [toggleTask])

  const handleDayKeyDown = useCallback((e: React.KeyboardEvent, day: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleDay(day)
    }
  }, [toggleDay])

  return (
    <div className="space-y-6">
      <PageHeader
        title="新入社員チュートリアル"
        description="入社から架電開始までの研修スケジュール。タスクをクリアしていきましょう!"
        actions={
          completedCount > 0 ? (
            <Button variant="outline" size="sm" onClick={resetProgress}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              リセット
            </Button>
          ) : undefined
        }
      />

      {/* Progress Overview */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
        {/* Overall Progress Card */}
        <Card className="sm:col-span-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="h-20 w-20 rounded-full border-4 border-muted flex items-center justify-center relative">
                  <svg
                    className="absolute inset-0 h-20 w-20 -rotate-90"
                    viewBox="0 0 80 80"
                    role="progressbar"
                    aria-valuenow={overallProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`全体進捗 ${overallProgress}%`}
                  >
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-primary/20"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeDasharray={`${(overallProgress / 100) * 226.2} 226.2`}
                      strokeLinecap="round"
                      className="text-primary transition-all duration-700 ease-out"
                    />
                  </svg>
                  <span className="text-lg font-bold" aria-hidden="true">{overallProgress}%</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl" aria-hidden="true">{LEVEL_EMOJIS[level]}</span>
                  <span className="font-bold text-lg">{LEVEL_LABELS[level]}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {completedCount} / {totalTasks} タスク完了
                </p>
                {overallProgress === 100 && (
                  <div className="flex items-center gap-1 mt-1 text-sm text-primary font-medium">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    全ての研修が完了しました!
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Day Progress Cards */}
        {dayProgress.map((dp, i) => (
          <Card
            key={dp.day}
            role="button"
            tabIndex={0}
            aria-label={`${SCHEDULE[i].title} - ${dp.completed}/${dp.total} 完了`}
            className={`cursor-pointer transition-all hover:shadow-md ${
              expandedDays.has(dp.day) ? 'ring-2 ring-primary/20' : ''
            }`}
            onClick={() => toggleDay(dp.day)}
            onKeyDown={(e) => handleDayKeyDown(e, dp.day)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl" aria-hidden="true">{SCHEDULE[i].emoji}</span>
                {dp.percent === 100 ? (
                  <Trophy className="h-4 w-4 text-amber-500" aria-hidden="true" />
                ) : dp.percent > 0 ? (
                  <Star className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                ) : null}
              </div>
              <p className="font-semibold text-sm">{SCHEDULE[i].title}</p>
              <div
                className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-valuenow={dp.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${SCHEDULE[i].title} ${dp.percent}%完了`}
              >
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${SCHEDULE[i].color} transition-all duration-500`}
                  style={{ width: `${dp.percent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {dp.completed}/{dp.total} 完了
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Day Schedules */}
      <div className="space-y-4">
        {SCHEDULE.map((day, dayIndex) => {
          const isExpanded = expandedDays.has(day.day)
          const dp = dayProgress[dayIndex]

          return (
            <Card key={day.day} className="overflow-hidden">
              {/* Day Header */}
              <button
                className="w-full text-left"
                onClick={() => toggleDay(day.day)}
                aria-expanded={isExpanded}
                aria-controls={`day-${day.day}-tasks`}
              >
                <CardHeader className="hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${day.color} flex items-center justify-center text-white text-lg`} aria-hidden="true">
                        {day.emoji}
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {day.title}
                          {dp.percent === 100 && (
                            <Badge variant="default" className="text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
                              完了
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{day.subtitle}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground hidden sm:inline">
                        {dp.completed}/{dp.total}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </button>

              {/* Task List */}
              {isExpanded && (
                <CardContent id={`day-${day.day}-tasks`} className="pt-0 pb-4">
                  <div className="space-y-1" role="list" aria-label={`${day.title}のタスク一覧`}>
                    {day.tasks.map((task, index) => {
                      const isCompleted = completedTasks.has(task.id)
                      const catStyle = CATEGORY_STYLES[task.category]
                      const TaskIcon = task.icon

                      return (
                        <div
                          key={task.id}
                          role="checkbox"
                          aria-checked={isCompleted}
                          aria-label={`${task.title} - ${task.time}`}
                          tabIndex={0}
                          className={`group flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer
                            ${isCompleted
                              ? 'bg-primary/5 opacity-75'
                              : 'hover:bg-muted/50'
                            }`}
                          onClick={() => toggleTask(task.id)}
                          onKeyDown={(e) => handleTaskKeyDown(e, task.id)}
                        >
                          {/* Check Icon */}
                          <div className="flex-shrink-0 mt-0.5" aria-hidden="true">
                            {isCompleted ? (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground group-hover:text-primary/60 transition-colors" />
                            )}
                          </div>

                          {/* Timeline connector */}
                          <div className="flex-shrink-0 flex flex-col items-center mt-0.5" aria-hidden="true">
                            <div className={`h-5 w-5 rounded-full flex items-center justify-center ${catStyle.bg} ${catStyle.text}`}>
                              <TaskIcon className="h-4 w-4" />
                            </div>
                            {index < day.tasks.length - 1 && (
                              <div className="w-px h-full min-h-[20px] bg-border mt-1" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-medium text-sm ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                {task.title}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${catStyle.bg} ${catStyle.text}`}>
                                {catStyle.label}
                              </span>
                            </div>
                            <p className={`text-xs mt-0.5 whitespace-pre-line ${isCompleted ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                              {task.description}
                            </p>
                            {/* Time on mobile */}
                            <p className="text-xs text-muted-foreground mt-1 sm:hidden">
                              {task.time}（{task.duration}）
                            </p>
                          </div>

                          {/* Time (desktop) */}
                          <div className="flex-shrink-0 text-right hidden sm:block">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {task.time}
                            </div>
                            <span className="text-xs text-muted-foreground/60">{task.duration}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Tips Card */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <Star className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-sm mb-1">研修のポイント</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>- わからないことはすぐに質問しましょう。周りのメンバーがサポートします</li>
                <li>- MENTERの学習はペースを守って進めましょう</li>
                <li>- ロープレは恥ずかしがらずに本番のつもりで!</li>
                <li>- 3日目以降もロープレが必要な場合は、9:30〜10:00の準備時間を活用できます</li>
                <li>- 日報は毎日17:30〜17:45に提出してください</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
