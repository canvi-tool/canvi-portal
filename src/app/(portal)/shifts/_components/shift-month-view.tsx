'use client'

import { useMemo } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

// --- Types ---

type ShiftStatus = 'SUBMITTED' | 'APPROVED' | 'NEEDS_REVISION'

interface ShiftItem {
  id: string
  staffId: string
  staffName: string
  projectId: string
  projectName: string
  date: string
  startTime: string
  endTime: string
  status: ShiftStatus
}

interface ShiftMonthViewProps {
  shifts: ShiftItem[]
}

/* STATUS_LABELS moved to constants */

interface MonthlySummaryRow {
  staffId: string
  staffName: string
  projectName: string
  workingDays: number
  totalHours: number
  approvedCount: number
  pendingCount: number
  otherCount: number
}

export function ShiftMonthView({ shifts }: ShiftMonthViewProps) {
  const summaryRows = useMemo(() => {
    const groupMap = new Map<string, MonthlySummaryRow>()

    for (const shift of shifts) {
      const key = `${shift.staffId}_${shift.projectId}`

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          staffId: shift.staffId,
          staffName: shift.staffName,
          projectName: shift.projectName,
          workingDays: 0,
          totalHours: 0,
          approvedCount: 0,
          pendingCount: 0,
          otherCount: 0,
        })
      }

      const row = groupMap.get(key)!
      row.workingDays++

      // Calculate hours
      const startParts = shift.startTime.split(':').map(Number)
      const endParts = shift.endTime.split(':').map(Number)
      const hours = (endParts[0] + endParts[1] / 60) - (startParts[0] + startParts[1] / 60)
      row.totalHours += hours

      if (shift.status === 'APPROVED') row.approvedCount++
      else if (shift.status === 'SUBMITTED') row.pendingCount++
      else row.otherCount++
    }

    // Round values
    for (const row of groupMap.values()) {
      row.totalHours = Math.round(row.totalHours * 100) / 100
    }

    return Array.from(groupMap.values()).sort((a, b) =>
      a.staffName.localeCompare(b.staffName, 'ja')
    )
  }, [shifts])

  if (summaryRows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        該当するシフトデータがありません
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>スタッフ名</TableHead>
            <TableHead>PJ名</TableHead>
            <TableHead className="text-right">勤務日数</TableHead>
            <TableHead className="text-right">総時間</TableHead>
            <TableHead className="text-right">承認済</TableHead>
            <TableHead className="text-right">承認待ち</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summaryRows.map((row) => (
            <TableRow key={`${row.staffId}_${row.projectName}`}>
              <TableCell className="font-medium">{row.staffName}</TableCell>
              <TableCell>{row.projectName}</TableCell>
              <TableCell className="text-right">{row.workingDays}日</TableCell>
              <TableCell className="text-right">{row.totalHours}h</TableCell>
              <TableCell className="text-right">
                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 text-[10px]">
                  {row.approvedCount}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {row.pendingCount > 0 ? (
                  <Badge variant="default" className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                    {row.pendingCount}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">0</span>
                )}
              </TableCell>
            </TableRow>
          ))}

          {/* Totals row */}
          <TableRow className="bg-muted/50 font-medium">
            <TableCell colSpan={2}>合計</TableCell>
            <TableCell className="text-right">
              {summaryRows.reduce((sum, r) => sum + r.workingDays, 0)}日
            </TableCell>
            <TableCell className="text-right">
              {Math.round(summaryRows.reduce((sum, r) => sum + r.totalHours, 0) * 100) / 100}h
            </TableCell>
            <TableCell className="text-right">
              {summaryRows.reduce((sum, r) => sum + r.approvedCount, 0)}
            </TableCell>
            <TableCell className="text-right">
              {summaryRows.reduce((sum, r) => sum + r.pendingCount, 0)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
