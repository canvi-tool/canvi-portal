'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Video, Copy, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { toast } from 'sonner'

interface AvailabilityCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedUserIds: string[]
  allUserIds: string[]
  initialDate: string
  initialStartTime: string
  initialEndTime: string
  memberNames: Record<string, string>
  onCreated?: () => void
}

export function AvailabilityCreateDialog({
  open,
  onOpenChange,
  selectedUserIds,
  allUserIds,
  initialDate,
  initialStartTime,
  initialEndTime,
  memberNames,
  onCreated,
}: AvailabilityCreateDialogProps) {
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState(initialStartTime)
  const [endTime, setEndTime] = useState(initialEndTime)
  const [withMeet, setWithMeet] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ meetUrl: string } | null>(null)

  // 招待メンバー管理
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set(selectedUserIds))
  const [inviteExpanded, setInviteExpanded] = useState(false)
  const [inviteSearch, setInviteSearch] = useState('')

  useEffect(() => {
    setDate(initialDate)
    setStartTime(initialStartTime)
    setEndTime(initialEndTime)
  }, [initialDate, initialStartTime, initialEndTime])

  // ダイアログが開くたびにselectedUserIdsで招待リストを初期化
  useEffect(() => {
    if (open) {
      setInvitedIds(new Set(selectedUserIds))
      setInviteExpanded(false)
      setInviteSearch('')
    }
  }, [open, selectedUserIds])

  const toggleInvite = (id: string) => {
    setInvitedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 全メンバーリスト（検索フィルタ付き）
  const filteredMembers = useMemo(() => {
    const all = allUserIds.map(id => ({ id, name: memberNames[id] || id }))
    if (!inviteSearch) return all
    const q = inviteSearch.toLowerCase()
    return all.filter(m => m.name.toLowerCase().includes(q))
  }, [allUserIds, memberNames, inviteSearch])

  const handleCreate = async () => {
    if (!summary || !date || !startTime || !endTime) {
      toast.error('タイトル、日付、時刻は必須です')
      return
    }
    if (invitedIds.size === 0) {
      toast.error('招待メンバーを1人以上選択してください')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: Array.from(invitedIds),
          summary,
          description,
          start_datetime: `${date}T${startTime}:00+09:00`,
          end_datetime: `${date}T${endTime}:00+09:00`,
          with_meet: withMeet,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '予定の作成に失敗しました')
      }

      const data = await res.json()
      toast.success('予定を作成しました')
      setResult({ meetUrl: data.meetUrl || '' })
      onCreated?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '予定の作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const participantNames = Array.from(invitedIds)
    .map(id => memberNames[id] || id)
    .join('、')

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); setResult(null) }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>予定を作成</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-4">
            <div className="text-green-600 text-lg font-medium text-center">予定を作成しました</div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div><span className="font-medium">タイトル:</span> {summary}</div>
              <div><span className="font-medium">日時:</span> {date} {startTime} 〜 {endTime}</div>
              <div><span className="font-medium">参加者:</span> {participantNames}</div>
              {description && (
                <div><span className="font-medium">説明:</span> {description}</div>
              )}
              {result.meetUrl && (
                <div className="flex items-center gap-1.5">
                  <Video className="h-4 w-4 text-blue-500 shrink-0" />
                  <a
                    href={result.meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {result.meetUrl}
                  </a>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const lines = [
                    summary,
                    `日時: ${date} ${startTime} 〜 ${endTime}`,
                    `参加者: ${participantNames}`,
                  ]
                  if (description) lines.push(`説明: ${description}`)
                  if (result.meetUrl) lines.push(`\nGoogle Meet: ${result.meetUrl}`)
                  navigator.clipboard.writeText(lines.join('\n'))
                  toast.success('予定情報をコピーしました')
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                予定情報をコピー
              </Button>
              <Button onClick={() => { onOpenChange(false); setResult(null) }}>
                閉じる
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 招待メンバー選択 */}
            <div className="space-y-1.5">
              <button
                type="button"
                className="flex items-center justify-between w-full text-sm"
                onClick={() => setInviteExpanded(!inviteExpanded)}
              >
                <span className="font-medium">招待メンバー ({invitedIds.size}人)</span>
                {inviteExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {!inviteExpanded && (
                <div className="text-xs text-muted-foreground truncate">
                  {participantNames || '選択なし'}
                </div>
              )}

              {inviteExpanded && (
                <div className="border rounded-md">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={inviteSearch}
                        onChange={(e) => setInviteSearch(e.target.value)}
                        placeholder="名前で検索"
                        className="h-7 pl-7 text-xs"
                      />
                    </div>
                  </div>
                  <div className="max-h-[180px] overflow-y-auto p-1">
                    {filteredMembers.map(m => (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={invitedIds.has(m.id)}
                          onChange={() => toggleInvite(m.id)}
                          className="rounded"
                        />
                        <span className="truncate">{m.name}</span>
                      </label>
                    ))}
                    {filteredMembers.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-2">該当なし</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>タイトル</Label>
              <Input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="ミーティング名"
              />
            </div>

            <div className="space-y-1.5">
              <Label>日付</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>開始</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>終了</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>説明（任意）</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={withMeet}
                onChange={(e) => setWithMeet(e.target.checked)}
                className="rounded"
              />
              Google Meet リンクを生成
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? '作成中...' : '作成'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
