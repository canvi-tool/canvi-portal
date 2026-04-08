'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface AvailabilityPanelProps {
  selectedStaffIds: string[]
  staffList: Array<{ id: string; name: string; userId?: string }>
}

type Period = 3 | 7 | 14 | 28
type Duration = 30 | 45 | 60 | 90 | 120
type Mode = 'all_free' | 'any_free'

interface Slot {
  start: string
  end: string
  date: string
  startTime: string
  endTime: string
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

export function AvailabilityPanel({ selectedStaffIds, staffList }: AvailabilityPanelProps) {
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [excludeHolidays, setExcludeHolidays] = useState<boolean>(true)
  const [periodDays, setPeriodDays] = useState<Period>(7)
  const [durationMinutes, setDurationMinutes] = useState<Duration>(60)
  const [mode, setMode] = useState<Mode>('all_free')
  const [timeStart, setTimeStart] = useState('09:00')
  const [timeEnd, setTimeEnd] = useState('19:00')
  const [title, setTitle] = useState('日程調整')
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [issuing, setIssuing] = useState(false)

  const memberUserIds = useMemo(() => {
    return selectedStaffIds
      .map((sid) => staffList.find((s) => s.id === sid)?.userId)
      .filter((uid): uid is string => !!uid)
  }, [selectedStaffIds, staffList])

  const toggleWeekday = (wd: number) => {
    setWeekdays((prev) =>
      prev.includes(wd) ? prev.filter((x) => x !== wd) : [...prev, wd].sort()
    )
  }

  const handleSearch = async () => {
    if (memberUserIds.length === 0) {
      toast.error('スタッフを選択してください（user_id が紐付いたスタッフのみ対象）')
      return
    }
    if (weekdays.length === 0) {
      toast.error('曜日を1つ以上選択してください')
      return
    }
    setLoading(true)
    setSlots(null)
    try {
      const res = await fetch('/api/scheduling/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_user_ids: memberUserIds,
          mode,
          period_days: periodDays,
          duration_minutes: durationMinutes,
          weekdays,
          exclude_holidays: excludeHolidays,
          time_range_start: timeStart,
          time_range_end: timeEnd,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || '検索に失敗しました')
        return
      }
      setSlots(json.slots || [])
    } catch (e) {
      console.error(e)
      toast.error('検索に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleIssueLink = async () => {
    if (memberUserIds.length === 0) {
      toast.error('スタッフを選択してください')
      return
    }
    if (!title.trim()) {
      toast.error('タイトルを入力してください')
      return
    }
    setIssuing(true)
    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const end = new Date(tomorrow)
      end.setDate(end.getDate() + periodDays - 1)
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      const res = await fetch('/api/scheduling/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          member_ids: memberUserIds,
          mode,
          date_range_start: fmt(tomorrow),
          date_range_end: fmt(end),
          time_range_start: timeStart,
          time_range_end: timeEnd,
          duration_minutes: durationMinutes,
          weekdays,
          exclude_holidays: excludeHolidays,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'リンク作成に失敗しました')
        return
      }
      const url: string = json.url
      try {
        await navigator.clipboard.writeText(url)
        toast.success(`URLをコピーしました: ${url}`)
      } catch {
        toast.success(`URL発行: ${url}`)
      }
    } catch (e) {
      console.error(e)
      toast.error('リンク作成に失敗しました')
    } finally {
      setIssuing(false)
    }
  }

  const slotsByDate = useMemo(() => {
    if (!slots) return null
    const map: Record<string, Slot[]> = {}
    for (const s of slots) {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    }
    return map
  }, [slots])

  const emailTemplate = useMemo(() => {
    if (!slotsByDate) return ''
    const dates = Object.keys(slotsByDate).sort()
    if (dates.length === 0) return ''
    const lines = ['■候補日時']
    for (const date of dates) {
      const [, m, d] = date.split('-').map(Number)
      const wd = WEEKDAY_LABELS[new Date(date + 'T00:00:00+09:00').getDay()]
      const ranges = slotsByDate[date]
        .map((s) => `${s.startTime}~${s.endTime}`)
        .join(' / ')
      lines.push(`●${m}月${d}日（${wd}） ${ranges}`)
    }
    return lines.join('\n')
  }, [slotsByDate])

  const handleCopyTemplate = async () => {
    if (!emailTemplate) {
      toast.error('コピーする候補日時がありません')
      return
    }
    try {
      await navigator.clipboard.writeText(emailTemplate)
      toast.success('メール用テンプレをコピーしました')
    } catch {
      toast.error('コピーに失敗しました')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>対象スタッフ</Label>
            <div className="text-sm text-muted-foreground">
              選択中: {selectedStaffIds.length}名 / user紐付け: {memberUserIds.length}名
            </div>
          </div>

          <div className="space-y-2">
            <Label>タイトル</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="日程調整" />
          </div>

          <div className="space-y-2">
            <Label>曜日</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((label, wd) => {
                const active = weekdays.includes(wd)
                return (
                  <button
                    key={wd}
                    type="button"
                    onClick={() => toggleWeekday(wd)}
                    className={`h-8 w-8 rounded-full border text-sm transition ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-input hover:bg-accent'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="exclude-holidays"
              checked={excludeHolidays}
              onChange={(e) => setExcludeHolidays(e.target.checked)}
            />
            <Label htmlFor="exclude-holidays" className="cursor-pointer">
              日本の祝日を除外
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>期間</Label>
              <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v) as Period)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">直近3日間</SelectItem>
                  <SelectItem value="7">1週間</SelectItem>
                  <SelectItem value="14">2週間</SelectItem>
                  <SelectItem value="28">4週間</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>所要時間</Label>
              <Select
                value={String(durationMinutes)}
                onValueChange={(v) => setDurationMinutes(Number(v) as Duration)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30分</SelectItem>
                  <SelectItem value="45">45分</SelectItem>
                  <SelectItem value="60">60分</SelectItem>
                  <SelectItem value="90">90分</SelectItem>
                  <SelectItem value="120">120分</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>開始時刻</Label>
              <Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>終了時刻</Label>
              <Input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>判定モード</Label>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="avail-mode"
                  checked={mode === 'all_free'}
                  onChange={() => setMode('all_free')}
                />
                <span className="text-sm">A: 全員空き</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="avail-mode"
                  checked={mode === 'any_free'}
                  onChange={() => setMode('any_free')}
                />
                <span className="text-sm">B: 誰か空き</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSearch} disabled={loading} className="flex-1">
              {loading ? '検索中...' : '空き枠を検索'}
            </Button>
            <Button
              variant="outline"
              onClick={handleIssueLink}
              disabled={issuing}
              className="flex-1"
            >
              {issuing ? '発行中...' : '日程調整URLを発行'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {slotsByDate && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium">
                検索結果: {slots?.length || 0} 枠
              </div>
              <Button size="sm" variant="outline" onClick={handleCopyTemplate} disabled={!emailTemplate}>
                メール用テンプレをコピー
              </Button>
            </div>
            {emailTemplate && (
              <pre className="mb-3 whitespace-pre-wrap rounded border bg-muted/30 p-2 text-xs">{emailTemplate}</pre>
            )}
            {Object.keys(slotsByDate).length === 0 ? (
              <div className="text-sm text-muted-foreground">条件に合う空き枠がありません</div>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-auto">
                {Object.entries(slotsByDate).map(([date, daySlots]) => (
                  <div key={date}>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">{date}</div>
                    <div className="flex flex-wrap gap-1">
                      {daySlots.map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded border border-input bg-background px-2 py-0.5 text-xs"
                        >
                          {s.startTime}-{s.endTime}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
