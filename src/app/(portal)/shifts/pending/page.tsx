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

} from 'lucide-react'

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

// --- Types ---

type ShiftStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION'

interface PendingShift {
  id: string
  staffId: string
  staffName: string
  projectId: string
  projectName: string
  date: string
  startTime: string
  endTime: string
  status: ShiftStatus
  submittedAt: string
  notes?: string
  approvalHistory: ApprovalEvent[]
}

interface ApprovalEvent {
  action: string
  by: string
  at: string
  comment?: string
}

// --- Demo Data ---

const today = new Date()
function dayOffset(offset: number): string {
  const d = new Date(today)
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const INITIAL_SHIFTS: PendingShift[] = [
  {
    id: 'p1',
    staffId: 's2',
    staffName: '田中美咲',
    projectId: 'pj2',
    projectName: 'WHITE営業代行',
    date: dayOffset(0),
    startTime: '10:00',
    endTime: '19:00',
    status: 'SUBMITTED',
    submittedAt: '2026-03-27T20:00:00',
    notes: '午前中はミーティングあり',
    approvalHistory: [
      { action: '作成', by: '田中美咲', at: '2026-03-27T19:50:00' },
      { action: '申請', by: '田中美咲', at: '2026-03-27T20:00:00' },
    ],
  },
  {
    id: 'p2',
    staffId: 's1',
    staffName: '佐藤健太',
    projectId: 'pj3',
    projectName: 'ミズテック受電',
    date: dayOffset(1),
    startTime: '09:00',
    endTime: '18:00',
    status: 'SUBMITTED',
    submittedAt: '2026-03-28T08:00:00',
    approvalHistory: [
      { action: '作成', by: '佐藤健太', at: '2026-03-28T07:50:00' },
      { action: '申請', by: '佐藤健太', at: '2026-03-28T08:00:00' },
    ],
  },
  {
    id: 'p3',
    staffId: 's3',
    staffName: '鈴木一郎',
    projectId: 'pj2',
    projectName: 'WHITE営業代行',
    date: dayOffset(2),
    startTime: '09:00',
    endTime: '17:00',
    status: 'SUBMITTED',
    submittedAt: '2026-03-28T10:00:00',
    notes: '15時に外出予定',
    approvalHistory: [
      { action: '作成', by: '鈴木一郎', at: '2026-03-28T09:45:00' },
      { action: '申請', by: '鈴木一郎', at: '2026-03-28T10:00:00' },
    ],
  },
  {
    id: 'p4',
    staffId: 's4',
    staffName: '山田花子',
    projectId: 'pj3',
    projectName: 'ミズテック受電',
    date: dayOffset(0),
    startTime: '13:00',
    endTime: '22:00',
    status: 'SUBMITTED',
    submittedAt: '2026-03-27T22:00:00',
    approvalHistory: [
      { action: '作成', by: '山田花子', at: '2026-03-27T21:50:00' },
      { action: '申請', by: '山田花子', at: '2026-03-27T22:00:00' },
    ],
  },
  {
    id: 'p5',
    staffId: 's5',
    staffName: '高橋雄太',
    projectId: 'pj2',
    projectName: 'WHITE営業代行',
    date: dayOffset(-1),
    startTime: '13:00',
    endTime: '22:00',
    status: 'SUBMITTED',
    submittedAt: '2026-03-26T23:00:00',
    notes: '夜間対応込み',
    approvalHistory: [
      { action: '作成', by: '高橋雄太', at: '2026-03-26T22:45:00' },
      { action: '申請', by: '高橋雄太', at: '2026-03-26T23:00:00' },
    ],
  },
]

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`
}

// --- Component ---

export default function PendingApprovalsPage() {
  const router = useRouter()
  const [shifts, setShifts] = useState<PendingShift[]>(INITIAL_SHIFTS)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [detailShift, setDetailShift] = useState<PendingShift | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')

  const pendingShifts = useMemo(() => shifts.filter(s => s.status === 'SUBMITTED'), [shifts])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
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
      setSelectedIds(new Set(pendingShifts.map(s => s.id)))
    }
  }

  const openDetail = (shift: PendingShift) => {
    setDetailShift(shift)
    setEditStartTime(shift.startTime)
    setEditEndTime(shift.endTime)
    setComment('')
    setDialogOpen(true)
  }

  const handleAction = (id: string, action: 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION') => {
    setShifts(prev => prev.map(s => {
      if (s.id !== id) return s
      return {
        ...s,
        status: action,
        startTime: editStartTime || s.startTime,
        endTime: editEndTime || s.endTime,
        approvalHistory: [
          ...s.approvalHistory,
          {
            action: action === 'APPROVED' ? '承認' : action === 'REJECTED' ? '却下' : '修正依頼',
            by: '管理者',
            at: new Date().toISOString(),
            comment: comment || undefined,
          },
        ],
      }
    }))
    setDialogOpen(false)
    setDetailShift(null)
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleBulkApprove = () => {
    setShifts(prev => prev.map(s => {
      if (!selectedIds.has(s.id)) return s
      return {
        ...s,
        status: 'APPROVED' as ShiftStatus,
        approvalHistory: [
          ...s.approvalHistory,
          { action: '一括承認', by: '管理者', at: new Date().toISOString() },
        ],
      }
    }))
    setSelectedIds(new Set())
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
          <Button size="sm" onClick={handleBulkApprove}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
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
                {pendingShifts.map(shift => (
                  <TableRow
                    key={shift.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(shift)}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(shift.id)}
                        onChange={() => toggleSelect(shift.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{shift.staffName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{shift.projectName}</Badge>
                    </TableCell>
                    <TableCell>{formatDateJP(shift.date)}</TableCell>
                    <TableCell>{shift.startTime} - {shift.endTime}</TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-amber-100 text-amber-800 border-amber-200">
                        申請中
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(shift.submittedAt)}
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700"
                          onClick={() => handleAction(shift.id, 'APPROVED')}
                        >
                          承認
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={() => handleAction(shift.id, 'REJECTED')}
                        >
                          却下
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-orange-700 border-orange-300 hover:bg-orange-50"
                          onClick={() => {
                            openDetail(shift)
                          }}
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
                  <span className="text-sm font-medium">{detailShift.staffName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{detailShift.projectName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formatDateJP(detailShift.date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{detailShift.startTime} - {detailShift.endTime}</span>
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
                      onChange={e => setEditStartTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-end" className="text-xs">終了</Label>
                    <Input
                      id="edit-end"
                      type="time"
                      value={editEndTime}
                      onChange={e => setEditEndTime(e.target.value)}
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
                  onChange={e => setComment(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Approval History */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">承認履歴</Label>
                <div className="space-y-2 max-h-[120px] overflow-y-auto">
                  {detailShift.approvalHistory.map((event, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1 shrink-0" />
                      <div>
                        <span className="font-medium">{event.action}</span>
                        <span className="text-muted-foreground"> - {event.by}</span>
                        <span className="text-muted-foreground ml-2">{formatDateTime(event.at)}</span>
                        {event.comment && (
                          <p className="text-muted-foreground mt-0.5">「{event.comment}」</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <div className="flex items-center gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                className="text-orange-700 border-orange-300 hover:bg-orange-50"
                onClick={() => detailShift && handleAction(detailShift.id, 'NEEDS_REVISION')}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                修正依頼
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => detailShift && handleAction(detailShift.id, 'REJECTED')}
              >
                <XCircle className="h-4 w-4 mr-1" />
                却下
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 ml-auto"
                onClick={() => detailShift && handleAction(detailShift.id, 'APPROVED')}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                承認
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
