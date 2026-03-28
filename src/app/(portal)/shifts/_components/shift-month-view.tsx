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
import type { ShiftWithRelations } from '@/hooks/use-shifts'

interface ShiftMonthViewProps {
  shifts: ShiftWithRelations[]
}

interface MonthlySummaryRow {
  staffId: string
  staffName: string
  projectName: string
  workingDays: number
  totalHours: number
  overtimeHours: number
}

const OVERTIME_THRESHOLD = 8 // hours per day

export function ShiftMonthView({ shifts }: ShiftMonthViewProps) {
  const summaryRows = useMemo(() => {
    const groupMap = new Map<string, MonthlySummaryRow>()

    for (const shift of shifts) {
      const key = `${shift.staff_id}_${shift.project_id || 'none'}`

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          staffId: shift.staff_id,
          staffName: shift.staff_name || '不明',
          projectName: shift.project_name || '未設定',
          workingDays: 0,
          totalHours: 0,
          overtimeHours: 0,
        })
      }

      const row = groupMap.get(key)!
      row.workingDays++

      const hours = shift.actual_hours || 0
      row.totalHours += hours

      if (hours > OVERTIME_THRESHOLD) {
        row.overtimeHours += hours - OVERTIME_THRESHOLD
      }
    }

    // Round values
    for (const row of groupMap.values()) {
      row.totalHours = Math.round(row.totalHours * 100) / 100
      row.overtimeHours = Math.round(row.overtimeHours * 100) / 100
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
            <TableHead className="text-right">残業時間</TableHead>
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
                {row.overtimeHours > 0 ? (
                  <span className="text-orange-600 font-medium">
                    {row.overtimeHours}h
                  </span>
                ) : (
                  <span className="text-muted-foreground">0h</span>
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
              {Math.round(summaryRows.reduce((sum, r) => sum + r.overtimeHours, 0) * 100) / 100}h
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
