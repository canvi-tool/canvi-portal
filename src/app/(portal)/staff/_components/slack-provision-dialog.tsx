'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { Loader2, Hash, Lock } from 'lucide-react'
import type { Tables } from '@/lib/types/database'

type Staff = Tables<'staff'>

interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  is_archived: boolean
  num_members?: number
}

interface SlackProvisionDialogProps {
  staff: Staff | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (staffId: string) => void
}

/**
 * メールアドレスから英字名を推測
 * e.g. yuji.okabayashi@canvi.co.jp → Yuji Okabayashi
 */
function guessEnglishName(email: string): string {
  const localPart = email.split('@')[0] || ''
  const parts = localPart.split(/[._]/)
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Slack表示名を生成
 * フォーマット: "Yuji Okabayashi / 岡林優治"
 */
function generateSlackDisplayName(staff: Staff): string {
  const englishName = guessEnglishName(staff.email)
  const japaneseName = `${staff.last_name}${staff.first_name}`
  return `${englishName} / ${japaneseName}`
}

export function SlackProvisionDialog({
  staff,
  open,
  onOpenChange,
  onSuccess,
}: SlackProvisionDialogProps) {
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set())
  const [channelFilter, setChannelFilter] = useState('')
  const [manualSlackId, setManualSlackId] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)

  // チャンネル一覧取得
  const fetchChannels = useCallback(async () => {
    setChannelsLoading(true)
    try {
      const res = await fetch('/api/slack/channels')
      const data = await res.json()
      if (data.channels) {
        setChannels(data.channels)
      }
    } catch {
      console.error('Failed to fetch channels')
    } finally {
      setChannelsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (staff && open) {
      setDisplayName(generateSlackDisplayName(staff))
      setSelectedChannels(new Set())
      setChannelFilter('')
      setManualSlackId('')
      setShowManualInput(false)
      fetchChannels()
    }
  }, [staff, open, fetchChannels])

  const filteredChannels = channels.filter((ch) =>
    ch.name.toLowerCase().includes(channelFilter.toLowerCase())
  )

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev)
      if (next.has(channelId)) {
        next.delete(channelId)
      } else {
        next.add(channelId)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    if (!staff || !displayName.trim()) return
    setLoading(true)

    try {
      const payload: Record<string, unknown> = {
        staff_id: staff.id,
        display_name: displayName.trim(),
        channel_ids: Array.from(selectedChannels),
      }
      if (manualSlackId.trim()) {
        payload.slack_user_id = manualSlackId.trim()
      }

      const res = await fetch('/api/slack/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        // ユーザー未発見 → 手動入力モードを表示
        if (data.error_code === 'user_not_found') {
          setShowManualInput(true)
          toast.error('Slackユーザーが見つかりません。手動でSlack User IDを入力するか、Slack管理画面から招待してください。')
          return
        }
        throw new Error(data.error || 'Slack連携に失敗しました')
      }

      // 結果メッセージ組み立て
      const msgs: string[] = []
      if (data.results?.workspace_invited) {
        msgs.push('ワークスペースに招待しました')
      }
      if (data.results?.channels_invited?.length > 0) {
        msgs.push(`${data.results.channels_invited.length}個のチャンネルに招待しました`)
      }
      if (data.results?.warnings?.length > 0) {
        for (const w of data.results.warnings) {
          toast.warning(w)
        }
      }

      toast.success(
        `${staff.last_name} ${staff.first_name} のSlack連携が完了しました${msgs.length > 0 ? '（' + msgs.join('、') + '）' : ''}`
      )

      onSuccess?.(staff.id)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Slack連携に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (!staff) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Slack連携・アカウント発行</DialogTitle>
          <DialogDescription>
            {staff.last_name} {staff.first_name}（{staff.email}）
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 表示名 */}
          <div className="space-y-2">
            <Label htmlFor="slack-display-name">Slack表示名</Label>
            <Input
              id="slack-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Yuji Okabayashi / 岡林優治"
            />
            <p className="text-xs text-muted-foreground">
              形式: 英字名（頭大文字） / 姓名
            </p>
          </div>

          {/* Slack User ID 手動入力（ユーザー未発見時） */}
          {showManualInput && (
            <div className="space-y-2 rounded-md border border-orange-200 bg-orange-50 p-3">
              <Label htmlFor="manual-slack-id" className="text-orange-800">
                Slack User ID（手動入力）
              </Label>
              <Input
                id="manual-slack-id"
                value={manualSlackId}
                onChange={(e) => setManualSlackId(e.target.value)}
                placeholder="U0XXXXXXXXX"
                className="font-mono"
              />
              <p className="text-xs text-orange-600">
                Slackでユーザーのプロフィールを開き「⋮」→「メンバーIDをコピー」で取得できます
              </p>
            </div>
          )}

          {/* チャンネル選択 */}
          <div className="space-y-2">
            <Label>招待するチャンネル（任意）</Label>
            <Input
              placeholder="チャンネル名で検索..."
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="h-8 text-sm"
            />
            {channelsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">チャンネル読み込み中...</span>
              </div>
            ) : (
              <ScrollArea className="h-[200px] rounded-md border">
                <div className="p-2 space-y-1">
                  {filteredChannels.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      チャンネルが見つかりません
                    </p>
                  ) : (
                    filteredChannels.map((ch) => (
                      <label
                        key={ch.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={selectedChannels.has(ch.id)}
                          onChange={() => toggleChannel(ch.id)}
                        />
                        {ch.is_private ? (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <Hash className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="truncate">{ch.name}</span>
                        {ch.num_members !== undefined && (
                          <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                            {ch.num_members}人
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
            {selectedChannels.size > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedChannels.size}個のチャンネルを選択中
              </p>
            )}
          </div>

          {/* 処理説明 */}
          <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">処理内容:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-xs">
              <li>{staff.email} でSlackユーザーを検索</li>
              <li>未登録の場合はワークスペースに招待</li>
              <li>表示名を設定</li>
              <li>選択したチャンネルに招待</li>
              <li>PortalとSlackアカウントを紐付け</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !displayName.trim()}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                処理中...
              </>
            ) : (
              '連携する'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
