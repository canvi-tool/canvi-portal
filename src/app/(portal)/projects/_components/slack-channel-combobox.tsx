'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { Hash, Lock, ChevronsUpDown, X, Loader2, AlertCircle, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  is_archived?: boolean
  num_members?: number
  purpose?: string
}

interface SlackChannelComboboxProps {
  value: string // channel ID
  onValueChange: (channelId: string, channelName: string) => void
  disabled?: boolean
  className?: string
}

export function SlackChannelCombobox({
  value,
  onValueChange,
  disabled = false,
  className,
}: SlackChannelComboboxProps) {
  const [open, setOpen] = useState(false)
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelPrivate, setNewChannelPrivate] = useState(false)
  const [creating, setCreating] = useState(false)

  // Fetch channels
  const fetchChannels = useCallback(() => {
    setLoading(true)
    fetch('/api/slack/channels')
      .then((r) => {
        if (r.status === 401) {
          setError('認証エラー: ログインし直してください')
          return null
        }
        if (r.status === 403) {
          setError('権限不足: Slackチャンネルの操作には管理者権限が必要です')
          return null
        }
        return r.json()
      })
      .then((res) => {
        if (!res) return
        if (res.channels) setChannels(res.channels)
        if (res.error && !res.channels?.length) {
          // Distinguish between "not configured" (genuinely no token) vs other API errors
          if (res.error.includes('not configured')) {
            setError('Slack未連携')
          } else {
            setError(res.error)
          }
        }
      })
      .catch(() => setError('Slackチャンネルの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  // Split channels
  const publicChannels = useMemo(
    () => channels.filter((ch) => !ch.is_private),
    [channels]
  )
  const privateChannels = useMemo(
    () => channels.filter((ch) => ch.is_private),
    [channels]
  )

  // Find selected channel
  const selectedChannel = useMemo(
    () => channels.find((ch) => ch.id === value),
    [channels, value]
  )

  const handleSelect = (channelId: string) => {
    if (channelId === '__none__') {
      onValueChange('', '')
    } else {
      const ch = channels.find((c) => c.id === channelId)
      onValueChange(channelId, ch ? ch.name : '')
    }
    setOpen(false)
  }

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error('チャンネル名を入力してください')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/slack/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChannelName.trim(),
          is_private: newChannelPrivate,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || 'チャンネルの作成に失敗しました')
        return
      }
      // Add to list and select
      const newChannel = data.channel as SlackChannel
      setChannels((prev) => [...prev, newChannel].sort((a, b) => a.name.localeCompare(b.name)))
      onValueChange(newChannel.id, newChannel.name)
      setCreateDialogOpen(false)
      setNewChannelName('')
      setNewChannelPrivate(false)
      toast.success(`チャンネル「${newChannel.name}」を作成しました`)
    } catch {
      toast.error('チャンネルの作成に失敗しました')
    } finally {
      setCreating(false)
    }
  }

  if (error && !channels.length) {
    const displayMessage = error === 'Slack未連携'
      ? 'Slack未連携: 設定 → 外部連携からSlack Bot Tokenを設定してください'
      : error
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{displayMessage}</span>
      </div>
    )
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled || loading}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors',
            'hover:bg-accent hover:text-accent-foreground cursor-pointer',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                読込中...
              </>
            ) : selectedChannel ? (
              <>
                {selectedChannel.is_private ? (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="text-foreground">{selectedChannel.name}</span>
              </>
            ) : (
              'チャンネルを検索・選択'
            )}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {value && !loading && (
              <span
                role="button"
                className="rounded-sm p-0.5 hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation()
                  onValueChange('', '')
                }}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="チャンネル名で検索..." />
            <CommandList className="max-h-60">
              <CommandEmpty>チャンネルが見つかりません</CommandEmpty>

              {/* 新規作成 + 通知なし */}
              <CommandGroup>
                <CommandItem
                  value="__create__ 新規作成"
                  onSelect={() => {
                    setOpen(false)
                    setCreateDialogOpen(true)
                  }}
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  <span className="text-primary font-medium">新規チャンネル作成</span>
                </CommandItem>
                <CommandItem
                  value="__none__ 通知なし"
                  onSelect={() => handleSelect('__none__')}
                  data-checked={!value ? true : undefined}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">（通知なし）</span>
                </CommandItem>
              </CommandGroup>

              <CommandSeparator />

              {/* パブリックチャンネル */}
              {publicChannels.length > 0 && (
                <CommandGroup heading="パブリックチャンネル">
                  {publicChannels.map((ch) => (
                    <CommandItem
                      key={ch.id}
                      value={ch.name}
                      onSelect={() => handleSelect(ch.id)}
                      data-checked={value === ch.id ? true : undefined}
                    >
                      <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{ch.name}</span>
                      {ch.num_members != null && (
                        <span className="ml-auto text-xs text-muted-foreground shrink-0">
                          {ch.num_members}人
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* プライベートチャンネル */}
              {privateChannels.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="プライベートチャンネル">
                    {privateChannels.map((ch) => (
                      <CommandItem
                        key={ch.id}
                        value={ch.name}
                        onSelect={() => handleSelect(ch.id)}
                        data-checked={value === ch.id ? true : undefined}
                      >
                        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{ch.name}</span>
                        {ch.num_members != null && (
                          <span className="ml-auto text-xs text-muted-foreground shrink-0">
                            {ch.num_members}人
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* チャンネル新規作成ダイアログ */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Slackチャンネル新規作成</DialogTitle>
            <DialogDescription>
              新しいSlackチャンネルを作成し、このプロジェクトに紐付けます
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="channel-name">
                チャンネル名 <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">#</span>
                <Input
                  id="channel-name"
                  value={newChannelName}
                  onChange={(e) =>
                    setNewChannelName(
                      e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, '-')
                        .replace(/[^a-z0-9\-_]/g, '')
                    )
                  }
                  placeholder="例: pj-221-通知"
                  disabled={creating}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                英数字・ハイフン・アンダースコアのみ使用可能
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="channel-private" className="text-sm font-medium cursor-pointer">
                  プライベートチャンネル
                </Label>
                <p className="text-xs text-muted-foreground">
                  招待されたメンバーのみ閲覧可能
                </p>
              </div>
              <Switch
                id="channel-private"
                checked={newChannelPrivate}
                onCheckedChange={setNewChannelPrivate}
                disabled={creating}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              キャンセル
            </DialogClose>
            <Button
              onClick={handleCreateChannel}
              disabled={creating || !newChannelName.trim()}
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              作成して選択
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
