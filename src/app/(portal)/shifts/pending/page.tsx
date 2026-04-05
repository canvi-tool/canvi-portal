'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  User,
  Briefcase,
  CalendarDays,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/layout/page-header'
import {
  usePendingShifts,
  useApproveShift,
  useRejectShift,
  useRequestRevision,
  type ShiftWithRelations,
} from '@/hooks/use-shifts'

// --- Helpers ---

const ACTION_LABEL: Record<string, string> = {
  APPROVE: '承認',
  REJECT: '却下',
  NEEDS_REVISION: '修正依頼',
  MODIFY: '修正',
  COMMENT: 'コメント',
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`
}

function formatTime(time: string): string {
  // start_time/end_time come as "HH:MM" or "HH:MM:SS" - show HH:MM
  return time.slice(0, 5)
}

// --- Component ---

export default function PendingApprovalsPage() {
  const router = useRouter()

  // Data fetching
  const { data: shifts = [], isLoading, isError } = usePendingShifts()

  // Mutations
  const approveShift = useApproveShift()
  const rejectShift = useRejectShift()
  const requestRevision = useRequestRevision()

  // UI state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [detailShift, setDetailShift] = useState<ShiftWithRelations | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')

  const pendingShifts = useMemo(
    () => shifts.filter((s) => s.status === 'SUBMITTED'),
    [shifts],
  )

  const isMutating = approveShift.isPending || rejectShift.isPending || requestRevision.isPending

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingShifts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingShifts.map((s) => s.id)))
    }
  }

  const openDetail = (shift: ShiftWithRelations) => {
    setDetailShift(shift)
    setEditStartTime(formatTime(shift.start_time))
    setEditEndTime(formatTime(shift.end_time))
    setComment('')
    setDialogOpen(true)
  }

  const handleApprove = (id: string) => {
    approveShift.mutate(
      { id, comment: comment || undefined },
      {
        onSuccess: () => {
          toast.success('シフトを承認しました')
          setDialogOpen(false)
          setDetailShift(null)
          setSelectedIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
        onError: (error) => {
          toast.error(error.message || '承認に失敗しました')
        },
      },
    )
  }

  const handleReject = (id: string) => {
    rejectShift.mutate(
      { id, comment: comment || undefined },
      {
        onSuccess: () => {
          toast.success('シフトを却下しました')
          setDialogOpen(false)
          setDetailShift(null)
          setSelectedIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
        onError: (error) => {
          toast.error(error.message || '却下に失敗しました')
        },
      },
    )
  }

  const handleRequestRevision = (id: string) => {
    requestRevision.mutate(
      {
        id,
        comment: comment || undefined,
        new_start_time: editStartTime || undefined,
        new_end_time: editEndTime || undefined,
      },
      {
        onSuccess: () => {
          toast.success('修正依頼を送信しました')
          setDialogOpen(false)
          setDetailShift(null)
          setSelectedIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
        onError: (error) => {
          toast.error(error.message || '修正依頼に失敗しました')
        },
      },
    )
  }

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds)
    let successCount = 0
    let errorCount = 0

    for (const id of ids) {
      try {
        await approveShift.mutateAsync({ id })
        successCount++
      } catch {
        errorCount++
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount}件のシフトを承認しました`)
    }
    if (errorCount > 0) {
      toast.error(`${errorCount}件の承認に失敗しました`)
    }
    setSelectedIds(new Set())
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="承認待ちシフト"
          description="申請されたシフトを確認し、承認・却下・修正依頼を行います"
          actions={
            <Button variant="outline" size="sm" onClick={() => router.push('/shifts')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              シフト一覧に戻る
            </Button>
          }
        />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">読み込み中...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="承認待ちシフト"
          description="申請されたシフトを確認し、承認・却下・修正依頼を行います"
          actions={
            <Button variant="outline" size="sm" onClick={() => router.push('/shifts')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              シフト一覧に戻る
            </Button>
          }
        />
        <div className="py-12 text-center text-destructive">
          データの取得に失敗しました。ページを再読み込みしてください。
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="承認待ちシフト"
        description="申請されたシフトを確認し、承認・却下・修正依頼を行います"
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/shifts')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            シフト一覧に戻る
          </Button>
        }
      />

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size}件選択中
          </span>
          <Button size="sm" onClick={handleBulkApprove} disabled={isMutating}>
            {approveShift.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            一括承認
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedIds(new Set())}
          >
            選択解除
          </Button>
        </div>
      )}

      {/* Pending Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">申請中シフト一覧</CardTitle>
          <CardDescription>
            {pendingShifts.length}件の承認待ちシフトがあります
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingShifts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              承認待ちのシフトはありません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === pendingShifts.length && pendingShifts.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>スタッフ</TableHead>
                  <TableHead>プロジェクト</TableHead>
                  <TableHead>日付</TableHead>
                  <TableHead>時間</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>申請日時</TableHead>
                  <TableHead className="text-right">アクション</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingShifts.map((shift) => (
                  <TableRow
                    key={shift.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(shift)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(shift.id)}
                        onChange={() => toggleSelect(shift.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{shift.staff_name ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{shift.project_name ?? '-'}</Badge>
                    </TableCell>
                    <TableCell>{formatDateJP(shift.shift_date)}</TableCell>
                    <TableCell>{formatTime(shift.start_time)} - {formatTime(shift.end_time)}</TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-amber-100 text-amber-800 border-amber-200">
                        申請中
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {shift.submitted_at ? formatDateTime(shift.submitted_at) : '-'}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700"
                          disabled={isMutating}
                          onClick={() => handleApprove(shift.id)}
                        >
                          承認
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          disabled={isMutating}
                          onClick={() => handleReject(shift.id)}
                        >
                          却下
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-orange-700 border-orange-300 hover:bg-orange-50"
                          disabled={isMutating}
                          onClick={() => openDetail(shift)}
                        >
                          修正依頼
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>シフト詳細</DialogTitle>
            <DialogDescription>
              シフト内容を確認し、承認・却下・修正依頼を行えます
            </DialogDescription>
          </DialogHeader>

          {detailShift && (
            <div className="space-y-4">
              {/* Shift Info */}
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{detailShift.staff_name ?? '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{detailShift.project_name ?? '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formatDateJP(detailShift.shift_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formatTime(detailShift.start_time)} - {formatTime(detailShift.end_time)}</span>
                </div>
                {detailShift.notes && (
                  <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                    備考: {detailShift.notes}
                  </div>
                )}
              </div>

              {/* Proxy Time Edit */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">代理修正（時間変更）</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-start" className="text-xs">開始</Label>
                    <Input
                      id="edit-start"
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-end" className="text-xs">終了</Label>
                    <Input
                      id="edit-end"
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Comment */}
              <div className="space-y-2">
                <Label htmlFor="comment" className="text-xs font-medium text-muted-foreground">コメント</Label>
                <Textarea
                  id="comment"
                  placeholder="コメントを入力（任意）"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Approval History */}
              {detailShift.approval_history && detailShift.approval_history.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">承認履歴</Label>
                  <div className="space-y-2 max-h-[120px] overflow-y-auto">
                    {detailShift.approval_history.map((event, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1 shrink-0" />
                        <div>
                          <span className="font-medium">{ACTION_LABEL[event.action] ?? event.action}</span>
                          <span className="text-muted-foreground"> - {event.performed_by}</span>
                          <span className="text-muted-foreground ml-2">{formatDateTime(event.performed_at)}</span>
                          {event.comment && (
                            <p className="text-muted-foreground mt-0.5">{event.comment}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <div className="flex items-center gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                className="text-orange-700 border-orange-300 hover:bg-orange-50"
                disabled={isMutating}
                onClick={() => detailShift && handleRequestRevision(detailShift.id)}
              >
                {requestRevision.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4 mr-1" />
                )}
                修正依頼
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isMutating}
                onClick={() => detailShift && handleReject(detailShift.id)}
              >
                {rejectShift.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-1" />
                )}
                却下
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 ml-auto"
                disabled={isMutating}
                onClick={() => detailShift && handleApprove(detailShift.id)}
              >
                {approveShift.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                )}
                承認
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
