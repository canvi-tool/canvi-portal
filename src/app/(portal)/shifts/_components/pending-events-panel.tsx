'use client'

import { useState, useMemo, useCallback } from 'react'
import { CalendarPlus, ClipboardList, Check, Ban, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

// --- Types ---

export interface PendingEvent {
  id: string
  event_date: string
  start_time: string
  end_time: string
  title: string | null
  external_event_id: string
  staff_name?: string
}

export interface PendingEventsPanelProps {
  /** Raw pending events from API (gcal_pending_events rows) */
  events: PendingEvent[]
  /** Available projects for assignment */
  projects: Array<{ id: string; name: string }>
  /** Assign a single event to a project */
  onAssign: (eventId: string, projectId: string) => Promise<void>
  /** Exclude a single event (mark as non-PJ) */
  onExclude: (eventId: string) => Promise<void>
  /** Bulk-assign multiple events to a single project */
  onBulkAssign: (eventIds: string[], projectId: string) => Promise<void>
  /** Bulk-exclude multiple events */
  onBulkExclude: (eventIds: string[]) => Promise<void>
  /** Called after any mutation to refresh parent data */
  onRefresh: () => void
  /** Whether the user is a manager (required for assign actions) */
  isManager: boolean
}

// --- Helpers ---

/** Group events by date, sorted chronologically */
function groupByDate(events: PendingEvent[]): Map<string, PendingEvent[]> {
  const map = new Map<string, PendingEvent[]>()
  const sorted = [...events].sort((a, b) => {
    const cmpDate = a.event_date.localeCompare(b.event_date)
    if (cmpDate !== 0) return cmpDate
    return a.start_time.localeCompare(b.start_time)
  })
  for (const ev of sorted) {
    const key = ev.event_date
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(ev)
  }
  return map
}

/** Format date string (YYYY-MM-DD) to a Japanese display format */
function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    const m = d.getMonth() + 1
    const day = d.getDate()
    const wd = weekdays[d.getDay()]
    return `${m}/${day}（${wd}）`
  } catch {
    return dateStr
  }
}

/** Format time (HH:MM:SS or HH:MM) to HH:MM */
function fmtTime(t: string): string {
  return (t || '').slice(0, 5)
}

// --- Sub-components ---

/** Individual event row used in both single-assign sheet and bulk-assign dialog */
function EventRow({
  event,
  projects,
  onAssign,
  onExclude,
  isAssigning,
  showCheckbox,
  checked,
  onCheckChange,
}: {
  event: PendingEvent
  projects: Array<{ id: string; name: string }>
  onAssign: (eventId: string, projectId: string) => void
  onExclude: (eventId: string) => void
  isAssigning: boolean
  showCheckbox?: boolean
  checked?: boolean
  onCheckChange?: (checked: boolean) => void
}) {
  const [selectedProjectId, setSelectedProjectId] = useState('')

  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors min-w-0">
      {showCheckbox && (
        <Checkbox
          checked={checked}
          onChange={(e) => onCheckChange?.(e.target.checked)}
          className="shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs text-muted-foreground shrink-0">
            {fmtTime(event.start_time)}-{fmtTime(event.end_time)}
          </span>
          <span className="text-sm truncate" title={event.title || '(無題)'}>
            {event.title || '(無題)'}
          </span>
        </div>
        {event.staff_name && (
          <span className="text-xs text-muted-foreground ml-[4.5rem]">
            {event.staff_name}
          </span>
        )}
      </div>
      {!showCheckbox && (
        <div className="flex items-center gap-1.5 shrink-0">
          <select
            className="h-7 rounded border px-1.5 text-xs max-w-[140px]"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={isAssigning}
          >
            <option value="">PJ選択</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button
            variant="default"
            size="icon-sm"
            disabled={!selectedProjectId || isAssigning}
            onClick={() => onAssign(event.id, selectedProjectId)}
            title="割当"
          >
            {isAssigning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isAssigning}
            onClick={() => onExclude(event.id)}
            title="PJではない（除外）"
          >
            <Ban className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      )}
    </div>
  )
}

// --- Main Panel Component ---

export function PendingEventsPanel({
  events,
  projects,
  onAssign,
  onExclude,
  onBulkAssign,
  onBulkExclude,
  onRefresh,
  isManager,
}: PendingEventsPanelProps) {
  // Sheet (single-assign mode) state
  const [sheetOpen, setSheetOpen] = useState(false)

  // Bulk-assign dialog state
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkProjectId, setBulkProjectId] = useState('')
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // Track per-event loading state for single assigns
  const [assigningId, setAssigningId] = useState<string | null>(null)

  const grouped = useMemo(() => groupByDate(events), [events])
  const count = events.length

  // --- Single assign handlers ---

  const handleAssign = useCallback(
    async (eventId: string, projectId: string) => {
      setAssigningId(eventId)
      try {
        await onAssign(eventId, projectId)
        toast.success('PJを割り当てました')
        onRefresh()
      } catch {
        toast.error('PJ割当に失敗しました')
      } finally {
        setAssigningId(null)
      }
    },
    [onAssign, onRefresh]
  )

  const handleExclude = useCallback(
    async (eventId: string) => {
      if (!confirm('この予定は業務PJではないとしてCanviから除外しますか？（次回同期でも再取込されません）')) return
      setAssigningId(eventId)
      try {
        await onExclude(eventId)
        toast.success('PJ対象外に設定しました')
        onRefresh()
      } catch {
        toast.error('除外に失敗しました')
      } finally {
        setAssigningId(null)
      }
    },
    [onExclude, onRefresh]
  )

  // --- Bulk assign handlers ---

  const openBulk = useCallback(() => {
    setBulkSelected(new Set(events.map((e) => e.id)))
    setBulkProjectId('')
    setBulkOpen(true)
  }, [events])

  const handleBulkSubmit = useCallback(async () => {
    if (bulkSelected.size === 0) return
    setBulkProcessing(true)
    try {
      if (bulkProjectId === '__EXCLUDE__') {
        await onBulkExclude(Array.from(bulkSelected))
        toast.success(`${bulkSelected.size}件をPJ対象外として除外しました`)
      } else if (bulkProjectId) {
        await onBulkAssign(Array.from(bulkSelected), bulkProjectId)
        toast.success(`${bulkSelected.size}件にPJを割り当てました`)
      }
      setBulkOpen(false)
      setBulkSelected(new Set())
      onRefresh()
    } catch {
      toast.error('一括処理に失敗しました')
    } finally {
      setBulkProcessing(false)
    }
  }, [bulkSelected, bulkProjectId, onBulkAssign, onBulkExclude, onRefresh])

  const toggleBulkItem = useCallback((id: string, checked: boolean) => {
    setBulkSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  // --- Render ---

  if (!isManager) return null

  return (
    <>
      {/* Trigger buttons (rendered inline in the header) */}
      {count > 0 && (
        <>
          <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
            <ClipboardList className="h-4 w-4 mr-1" />
            PJ割当
            <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-[10px]">
              {count}
            </Badge>
          </Button>
          <Button variant="outline" size="sm" onClick={openBulk}>
            <CalendarPlus className="h-4 w-4 mr-1" />
            PJ一括割当
            <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-[10px]">
              {count}
            </Badge>
          </Button>
        </>
      )}

      {/* Single-assign Sheet (slide from right) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              PJ未割当イベント
              {count > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {count}件
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-4 px-4">
            {count === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Check className="h-8 w-8 mb-2 text-green-500" />
                <p className="text-sm">未割当のイベントはありません</p>
              </div>
            ) : (
              <div className="space-y-1">
                {Array.from(grouped.entries()).map(([date, eventsForDate]) => (
                  <div key={date}>
                    <div className="sticky top-0 z-10 bg-popover/95 backdrop-blur-sm px-3 py-1.5 border-b">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {formatDateLabel(date)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({eventsForDate.length}件)
                      </span>
                    </div>
                    <div className="divide-y">
                      {eventsForDate.map((ev) => (
                        <EventRow
                          key={ev.id}
                          event={ev}
                          projects={projects}
                          onAssign={handleAssign}
                          onExclude={handleExclude}
                          isAssigning={assigningId === ev.id}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <SheetFooter>
            <Button variant="outline" size="sm" onClick={openBulk} disabled={count === 0}>
              <CalendarPlus className="h-4 w-4 mr-1" />
              一括割当に切り替え
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Bulk-assign Dialog */}
      <Dialog open={bulkOpen} onOpenChange={(o) => { if (!o) setBulkOpen(false) }}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] overflow-hidden">
          <DialogHeader>
            <DialogTitle>PJ未割当イベントを一括でPJに割当</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 min-w-0">
            {/* Project selector */}
            <div>
              <label className="text-sm font-medium">割当先プロジェクト</label>
              <select
                className="mt-1 w-full rounded border px-2 py-2 text-sm"
                value={bulkProjectId}
                onChange={(e) => setBulkProjectId(e.target.value)}
              >
                <option value="">選択してください</option>
                <option value="__EXCLUDE__">― PJではない（除外する）―</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Selection controls */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {bulkSelected.size} / {count} 件選択中
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setBulkSelected(new Set(events.map((e) => e.id)))}
                >
                  全選択
                </button>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setBulkSelected(new Set())}
                >
                  全解除
                </button>
              </div>
            </div>

            {/* Event list with checkboxes */}
            <div className="max-h-80 overflow-y-auto overflow-x-hidden rounded border min-w-0">
              {events.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  未割当のイベントはありません
                </div>
              ) : (
                <div className="divide-y min-w-0">
                  {Array.from(grouped.entries()).map(([date, eventsForDate]) => (
                    <div key={date}>
                      <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm px-3 py-1 border-b">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {formatDateLabel(date)}
                        </span>
                      </div>
                      {eventsForDate.map((ev) => {
                        const checked = bulkSelected.has(ev.id)
                        return (
                          <div
                            key={ev.id}
                            className="flex items-center gap-2 px-3 py-2 text-sm min-w-0 hover:bg-muted/30"
                          >
                            <Checkbox
                              checked={checked}
                              onChange={(e) => toggleBulkItem(ev.id, e.target.checked)}
                              className="shrink-0"
                            />
                            <span className="font-mono text-[11px] leading-tight text-muted-foreground w-20 shrink-0 whitespace-normal break-words">
                              {fmtTime(ev.start_time)}-{fmtTime(ev.end_time)}
                            </span>
                            <div
                              className="flex-1 min-w-0 truncate text-muted-foreground"
                              title={`${ev.staff_name || ''}${ev.title ? ' / ' + ev.title : ''}`}
                            >
                              {ev.staff_name || ''}{ev.title ? `  ${ev.title}` : '  (無題)'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              キャンセル
            </Button>
            <Button
              disabled={!bulkProjectId || bulkSelected.size === 0 || bulkProcessing}
              onClick={handleBulkSubmit}
            >
              {bulkProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  処理中...
                </>
              ) : bulkProjectId === '__EXCLUDE__' ? (
                `${bulkSelected.size}件を除外する`
              ) : (
                `${bulkSelected.size}件に割り当てる`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
