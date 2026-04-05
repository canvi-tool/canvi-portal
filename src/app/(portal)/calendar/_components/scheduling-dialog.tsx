'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Link2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface SchedulingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedUserIds: string[]
  memberNames: Record<string, string>
}

export function SchedulingDialog({
  open,
  onOpenChange,
  selectedUserIds,
  memberNames,
}: SchedulingDialogProps) {
  const [title, setTitle] = useState('日程調整')
  const [mode, setMode] = useState<'all_free' | 'any_free'>('all_free')
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })
  const [dateEnd, setDateEnd] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().split('T')[0]
  })
  const [timeStart, setTimeStart] = useState('09:00')
  const [timeEnd, setTimeEnd] = useState('18:00')
  const [duration, setDuration] = useState(60)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ url: string; slug: string } | null>(null)

  const participantNames = selectedUserIds
    .map(id => memberNames[id] || id)
    .join('、')

  const handleCreate = async () => {
    if (!title || !dateStart || !dateEnd) {
      toast.error('必須項目を入力してください')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/scheduling/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          member_ids: selectedUserIds,
          mode,
          date_range_start: dateStart,
          date_range_end: dateEnd,
          time_range_start: timeStart,
          time_range_end: timeEnd,
          duration_minutes: duration,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'リンクの作成に失敗しました')
      }

      const data = await res.json()
      setResult({ url: data.url, slug: data.slug })
      toast.success('日程調整URLを発行しました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    // リセット
    setTimeout(() => setResult(null), 300)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            日程調整URL発行
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="text-green-600 text-lg font-medium text-center">URLを発行しました</div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div><span className="font-medium">タイトル:</span> {title}</div>
              <div><span className="font-medium">参加者:</span> {participantNames}</div>
              <div>
                <span className="font-medium">モード:</span>{' '}
                {mode === 'all_free' ? '全員空き' : 'いずれか1人空き'}
              </div>
              <div><span className="font-medium">期間:</span> {dateStart} 〜 {dateEnd}</div>
              <div><span className="font-medium">時間帯:</span> {timeStart} 〜 {timeEnd}</div>
              <div><span className="font-medium">所要時間:</span> {duration}分</div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <p className="text-xs text-indigo-600 font-medium mb-1">日程調整URL</p>
              <p className="text-sm text-indigo-900 break-all font-mono">{result.url}</p>
            </div>

            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(result.url)
                  toast.success('URLをコピーしました')
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                URLをコピー
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(result.url, '_blank')}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                プレビュー
              </Button>
              <Button onClick={handleClose}>
                閉じる
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              対象メンバー: {participantNames}
            </div>

            <div className="space-y-1.5">
              <Label>タイトル</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="日程調整"
              />
            </div>

            {/* モード選択 */}
            <div className="space-y-2">
              <Label>空き判定モード</Label>
              <div className="grid grid-cols-1 gap-2">
                <label
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    mode === 'all_free'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value="all_free"
                    checked={mode === 'all_free'}
                    onChange={() => setMode('all_free')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium">全員が空いている時間のみ</div>
                    <div className="text-xs text-muted-foreground">
                      選択メンバー全員の予定が空いている時間帯だけを候補として表示します
                    </div>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    mode === 'any_free'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value="any_free"
                    checked={mode === 'any_free'}
                    onChange={() => setMode('any_free')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium">いずれか1人が空いていればOK</div>
                    <div className="text-xs text-muted-foreground">
                      メンバーのうち誰か1人でも空いていれば候補として表示します
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* 日程範囲 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>開始日</Label>
                <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>終了日</Label>
                <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
              </div>
            </div>

            {/* 時間帯 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>開始時刻</Label>
                <Input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>終了時刻</Label>
                <Input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)} />
              </div>
            </div>

            {/* 所要時間 */}
            <div className="space-y-1.5">
              <Label>1枠の所要時間</Label>
              <div className="flex gap-2">
                {[30, 60, 90, 120].map(min => (
                  <button
                    key={min}
                    onClick={() => setDuration(min)}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                      duration === min
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {min}分
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                キャンセル
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? '発行中...' : 'URLを発行'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
