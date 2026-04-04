'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, CopyPlus, CalendarPlus, Pencil, Trash2 } from 'lucide-react'

export type ContextMenuAction = 'edit' | 'copy-next-day' | 'copy-next-week' | 'copy-to-date' | 'delete'

interface ShiftContextMenuProps {
  x: number
  y: number
  shiftId: string
  shiftDate: string
  onAction: (action: ContextMenuAction, shiftId: string, targetDate?: string) => void
  onClose: () => void
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ShiftContextMenu({
  x,
  y,
  shiftId,
  shiftDate,
  onAction,
  onClose,
}: ShiftContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [datePicking, setDatePicking] = useState(false)
  const [targetDate, setTargetDate] = useState('')

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  // メニュー位置調整（画面外にはみ出さない）
  const menuStyle: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - 280),
  }

  if (datePicking) {
    return (
      <div ref={ref} className="shift-context-menu" style={menuStyle}>
        <div className="p-2">
          <p className="text-xs text-muted-foreground mb-2">コピー先の日付</p>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full text-sm border rounded px-2 py-1 mb-2"
            autoFocus
          />
          <div className="flex gap-1">
            <button
              className="flex-1 text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                if (targetDate) {
                  onAction('copy-to-date', shiftId, targetDate)
                }
              }}
              disabled={!targetDate}
            >
              コピー
            </button>
            <button
              className="flex-1 text-xs px-2 py-1 rounded border hover:bg-accent"
              onClick={() => setDatePicking(false)}
            >
              戻る
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} className="shift-context-menu" style={menuStyle}>
      <div
        className="shift-context-menu-item"
        onClick={() => onAction('edit', shiftId)}
      >
        <Pencil className="h-3.5 w-3.5" />
        編集
      </div>
      <div className="shift-context-menu-separator" />
      <div
        className="shift-context-menu-item"
        onClick={() => onAction('copy-next-day', shiftId, addDays(shiftDate, 1))}
      >
        <Copy className="h-3.5 w-3.5" />
        翌日にコピー
      </div>
      <div
        className="shift-context-menu-item"
        onClick={() => onAction('copy-next-week', shiftId, addDays(shiftDate, 7))}
      >
        <CopyPlus className="h-3.5 w-3.5" />
        翌週にコピー
      </div>
      <div
        className="shift-context-menu-item"
        onClick={() => setDatePicking(true)}
      >
        <CalendarPlus className="h-3.5 w-3.5" />
        日付を指定してコピー
      </div>
      <div className="shift-context-menu-separator" />
      <div
        className="shift-context-menu-item text-destructive"
        onClick={() => onAction('delete', shiftId)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        削除
      </div>
    </div>
  )
}
