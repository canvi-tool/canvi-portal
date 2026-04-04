'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { Hash, Lock, ChevronsUpDown, X, Loader2, AlertCircle } from 'lucide-react'
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

  // Fetch channels
  useEffect(() => {
    setLoading(true)
    fetch('/api/slack/channels')
      .then((r) => r.json())
      .then((res) => {
        if (res.channels) setChannels(res.channels)
        if (res.error && !res.channels?.length) setError(res.error)
      })
      .catch(() => setError('Slackチャンネルの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  // Split channels into public and private
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

  if (error && !channels.length) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Slack未連携: 設定 → 外部連携からSlack Bot Tokenを設定してください</span>
      </div>
    )
  }

  return (
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

            {/* 通知なしオプション */}
            <CommandGroup>
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
  )
}
