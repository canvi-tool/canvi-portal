'use client'

import { Clock, User, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// --- Types ---

type ShiftStatus = 'SUBMITTED' | 'APPROVED' | 'NEEDS_REVISION'

interface ShiftItem {
  id: string
  staffName: string
  projectName: string
  date: string
  startTime: string
  endTime: string
  status: ShiftStatus
  notes?: string
}

interface ShiftDayViewProps {
  date: string
  shifts: ShiftItem[]
  onShiftClick: (shift: ShiftItem) => void
  onClose: () => void
}

const STATUS_CONFIG: Record<ShiftStatus, { label: string; color: string; bgColor: string }> = {
  SUBMITTED: { label: '申請中', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-300' },
  APPROVED: { label: '承認済', color: 'text-green-700', bgColor: 'bg-green-50 border-green-300' },
  NEEDS_REVISION: { label: '修正依頼', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-300' },
}

function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekdays[d.getDay()]})`
}

export function ShiftDayView({
  date,
  shifts,
  onShiftClick,
  onClose,
}: ShiftDayViewProps) {
  const formattedDate = formatDateJP(date)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">{formattedDate}のシフト</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          閉じる
        </Button>
      </CardHeader>
      <CardContent>
        {shifts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            この日のシフトはありません
          </p>
        ) : (
          <div className="space-y-3">
            {shifts.map((shift) => {
              const config = STATUS_CONFIG[shift.status]
              return (
                <div
                  key={shift.id}
                  className="flex items-start justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onShiftClick(shift)}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{shift.staffName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{shift.projectName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {shift.startTime} ~ {shift.endTime}
                      </span>
                    </div>

                    {shift.notes && (
                      <div className="text-xs text-muted-foreground pl-6 mt-1">
                        {shift.notes}
                      </div>
                    )}
                  </div>

                  <Badge
                    variant="outline"
                    className={cn('border shrink-0', config.bgColor, config.color)}
                  >
                    {config.label}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
