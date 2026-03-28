'use client'

import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Clock, Edit2, Trash2, User, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ShiftWithRelations } from '@/hooks/use-shifts'

interface ShiftDayViewProps {
  date: string
  shifts: ShiftWithRelations[]
  onEdit: (shift: ShiftWithRelations) => void
  onDelete: (shiftId: string) => void
  onClose: () => void
}

export function ShiftDayView({
  date,
  shifts,
  onEdit,
  onDelete,
  onClose,
}: ShiftDayViewProps) {
  const formattedDate = format(new Date(date + 'T00:00:00'), 'yyyy年M月d日(E)', { locale: ja })

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
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className="flex items-start justify-between rounded-lg border p-3"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">
                      {shift.staff_name || '不明'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {shift.project_name || '未設定'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {shift.start_time
                        ? `${shift.start_time.slice(0, 5)} ~ ${shift.end_time?.slice(0, 5) || '--:--'}`
                        : '時間未設定'}
                    </span>
                    {shift.actual_hours !== undefined && shift.actual_hours > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {shift.actual_hours}h
                      </Badge>
                    )}
                  </div>

                  {shift.break_minutes > 0 && (
                    <div className="text-xs text-muted-foreground pl-6">
                      休憩: {shift.break_minutes}分
                    </div>
                  )}

                  {shift.notes && (
                    <div className="text-xs text-muted-foreground pl-6 mt-1">
                      {shift.notes}
                    </div>
                  )}

                  {shift.shift_type === 'synced' && (
                    <Badge variant="outline" className="text-xs mt-1">
                      Google Calendar同期
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(shift)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(shift.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
