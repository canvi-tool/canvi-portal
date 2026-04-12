'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface WorkStatusAlert {
  type: string
  staffId: string
  staffName: string
  projectName: string
  shiftDate: string
  shiftTime: string
  message: string
}

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes

export function WorkStatusAlertBanner() {
  const [alerts, setAlerts] = useState<WorkStatusAlert[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const fetchAlerts = useCallback(() => {
    fetch('/api/alerts/work-status')
      .then(r => r.json())
      .then(data => {
        if (data.alerts && data.alerts.length > 0) {
          setAlerts(data.alerts)
        } else {
          setAlerts([])
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  if (dismissed || alerts.length === 0) return null

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 px-4 py-3">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <div className="flex-1 text-sm text-amber-800 dark:text-amber-200">
          <span className="font-medium">
            ⚠️ 稼働状況アラート: {alerts.length}件
          </span>
          <span className="hidden sm:inline">
            {' '}- シフト予定があるのに打刻や日報が確認できないスタッフがいます
          </span>
        </div>
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 shrink-0"
          aria-label={expanded ? '閉じる' : '詳細を表示'}
        >
          {expanded
            ? <ChevronUp className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />
          }
        </button>
        <Link href="/attendance">
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
          >
            確認する
          </Button>
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-amber-200 dark:border-amber-800 pt-3 space-y-1.5">
          {alerts.map((alert, i) => (
            <div
              key={`${alert.staffId}-${alert.type}-${i}`}
              className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2"
            >
              <span className="font-medium">{alert.staffName}</span>
              <span className="text-amber-500 dark:text-amber-500">|</span>
              <span>{alert.projectName}</span>
              <span className="text-amber-500 dark:text-amber-500">|</span>
              <span>{alert.shiftTime}</span>
              <span className="text-amber-500 dark:text-amber-500">|</span>
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
