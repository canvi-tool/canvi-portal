'use client'

import { useState, useMemo } from 'react'
import { Search, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Member {
  id: string
  userId: string
  name: string
  projectNames: string[]
}

interface MemberSelectorProps {
  members: Member[]
  selectedIds: Set<string>
  onToggle: (userId: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

export function MemberSelector({
  members,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: MemberSelectorProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return members
    const q = search.toLowerCase()
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.projectNames.some(p => p.toLowerCase().includes(q))
    )
  }, [members, search])

  // PJ別にグループ化
  const groups = useMemo(() => {
    const map = new Map<string, Member[]>()
    for (const m of filtered) {
      if (m.projectNames.length === 0) {
        const key = '未所属'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(m)
      } else {
        for (const pn of m.projectNames) {
          if (!map.has(pn)) map.set(pn, [])
          map.get(pn)!.push(m)
        }
      }
    }
    return map
  }, [filtered])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          メンバー
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onSelectAll}
            className="text-[11px] text-primary hover:underline"
          >
            全選択
          </button>
          <span className="text-muted-foreground text-[11px]">/</span>
          <button
            onClick={onDeselectAll}
            className="text-[11px] text-primary hover:underline"
          >
            全解除
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="名前・PJで検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      <Badge variant="secondary" className="text-[11px]">
        {selectedIds.size}人選択中
      </Badge>

      <ScrollArea className="h-[400px]">
        <div className="space-y-4">
          {Array.from(groups.entries()).map(([groupName, groupMembers]) => (
            <div key={groupName}>
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5 px-1">
                {groupName}
              </p>
              <div className="space-y-0.5">
                {groupMembers.map(m => (
                  <label
                    key={`${groupName}-${m.userId}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.has(m.userId)}
                      onChange={() => onToggle(m.userId)}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{m.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
