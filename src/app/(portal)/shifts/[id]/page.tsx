'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Send,
  Clock,
  CalendarDays,
  Briefcase,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/layout/page-header'
import { cn } from '@/lib/utils'

// --- Types ---

type ShiftStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION'

interface ApprovalEvent {
  action: string
  by: string
  at: string
  comment?: string
}

interface ShiftDetail {
  id: string
  staffId: string
  staffName: string
  projectId: string
  projectName: string
  date: string
  startTime: string
  endTime: string
  status: ShiftStatus
  notes: string
  submittedAt?: string
  approvedAt?: string
  googleCalendarSynced: boolean
  googleCalendarEventId?: string
  approvalHistory: ApprovalEvent[]
}

// --- Demo Data ---

const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

function dayOffset(offset: number): string {
  const d = new Date(today)
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DEMO_SHIFTS: Record<string, ShiftDetail> = {
  '1': {
    id: '1',
    staffId: 's1',
    staffName: '佐藤健太',
    projectId: 'pj1',
    projectName: 'AIアポブースト',
    date: todayStr,
    startTime: '09:00',
    endTime: '18:00',
    status: 'APPROVED',
    notes: '',
    approvedAt: todayStr + 'T08:00:00',
    googleCalendarSynced: true,
    googleCalendarEventId: 'gcal_abc123',
    approvalHistory: [
      { action: '作成', by: '佐藤健太', at: dayOffset(-1) + 'T18:00:00' },
      { action: '自動承認', by: 'システム', at: dayOffset(-1) + 'T18:00:00' },
      { action: 'Googleカレンダー同期', by: 'システム', at: dayOffset(-1) + 'T18:01:00' },
    ],
  },
  '2': {
    id: '2',
    staffId: 's2',
    staffName: '田中美咲',
    projectId: 'pj2',
    projectName: 'WHITE営業代行',
    date: todayStr,
    startTime: '10:00',
    endTime: '19:00',
    status: 'SUBMITTED',
    notes: '午前中はミーティングあり',
    submittedAt: '2026-03-27T20:00:00',
    googleCalendarSynced: false,
    approvalHistory: [
      { action: '作成', by: '田中美咲', at: '2026-03-27T19:50:00' },
      { action: '申請', by: '田中美咲', at: '2026-03-27T20:00:00' },
    ],
  },
  '5': {
    id: '5',
    staffId: 's5',
    staffName: '高橋雄太',
    projectId: 'pj4',
    projectName: 'リクモ架電PJ',
    date: todayStr,
    startTime: '09:00',
    endTime: '18:00',
    status: 'DRAFT',
    notes: '',
    googleCalendarSynced: false,
    approvalHistory: [
      { action: '作成', by: '高橋雄太', at: todayStr + 'T07:00:00' },
    ],
  },
  '7': {
    id: '7',
    staffId: 's2',
    staffName: '田中美咲',
    projectId: 'pj3',
    projectName: 'ミズテック受電',
    date: dayOffset(-1),
    startTime: '10:00',
    endTime: '19:00',
    status: 'REJECTED',
    notes: '',
    googleCalendarSynced: false,
    approvalHistory: [
      { action: '作成', by: '田中美咲', at: dayOffset(-2) + 'T20:00:00' },
      { action: '申請', by: '田中美咲', at: dayOffset(-2) + 'T20:05:00' },
      { action: '却下', by: '管理者', at: dayOffset(-1) + 'T09:00:00', comment: '日程が重複しています。確認してください。' },
    ],
  },
  '9': {
    id: '9',
    staffId: 's5',
    staffName: '高橋雄太',
    projectId: 'pj2',
    projectName: 'WHITE営業代行',
    date: dayOffset(-1),
    startTime: '13:00',
    endTime: '22:00',
    status: 'NEEDS_REVISION',
    notes: '夜間対応込み',
    googleCalendarSynced: false,
    approvalHistory: [
      { action: '作成', by: '高橋雄太', at: dayOffset(-2) + 'T22:00:00' },
      { action: '申請', by: '高橋雄太', at: dayOffset(-2) + 'T22:05:00' },
      { action: '修正依頼', by: '管理者', at: dayOffset(-1) + 'T10:00:00', comment: '終了時間を21:00に修正してください（22時以降は深夜扱い）' },
    ],
  },
}

const PROJECTS = [
  { id: 'pj1', name: 'AIアポブースト' },
  { id: 'pj2', name: 'WHITE営業代行' },
  { id: 'pj3', name: 'ミズテック受電' },
  { id: 'pj4', name: 'リクモ架電PJ' },
]

const STATUS_CONFIG: Record<ShiftStatus, { label: string; color: string; bgColor: string; icon: typeof CheckCircle2 }> = {
  DRAFT: { label: '下書き', color: 'text-gray-700', bgColor: 'bg-gray-100 border-gray-300', icon: FileText },
  SUBMITTED: { label: '申請中', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-300', icon: Clock },
  APPROVED: { label: '承認済', color: 'text-green-700', bgColor: 'bg-green-50 border-green-300', icon: CheckCircle2 },
  REJECTED: { label: '却下', color: 'text-red-700', bgColor: 'bg-red-50 border-red-300', icon: XCircle },
  NEEDS_REVISION: { label: '修正依頼', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-300', icon: AlertTriangle },
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekdays[d.getDay()]})`
}

// --- Component ---

export default function ShiftDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const baseShift = DEMO_SHIFTS[id]

  const [shift, setShift] = useState<ShiftDetail | null>(baseShift || null)
  const [editing, setEditing] = useState(false)
  const [editDate, setEditDate] = useState(baseShift?.date || '')
  const [editStartTime, setEditStartTime] = useState(baseShift?.startTime || '')
  const [editEndTime, setEditEndTime] = useState(baseShift?.endTime || '')
  const [editProjectId, setEditProjectId] = useState(baseShift?.projectId || '')
  const [editNotes, setEditNotes] = useState(baseShift?.notes || '')

  const canEdit = shift && (shift.status === 'DRAFT' || shift.status === 'NEEDS_REVISION')

  if (!shift) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="シフト詳細"
          actions={
            <Button variant="outline" size="sm" onClick={() => router.push('/shifts')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              シフト一覧に戻る
            </Button>
          }
        />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            シフトが見つかりません (ID: {id})
            <br />
            <span className="text-xs">デモデータ: ID 1, 2, 5, 7, 9 が利用可能です</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[shift.status]
  const StatusIcon = statusConfig.icon

  const handleSave = () => {
    setShift(prev => {
      if (!prev) return prev
      return {
        ...prev,
        date: editDate,
        startTime: editStartTime,
        endTime: editEndTime,
        projectId: editProjectId,
        projectName: PROJECTS.find(p => p.id === editProjectId)?.name || prev.projectName,
        notes: editNotes,
        approvalHistory: [
          ...prev.approvalHistory,
          { action: '編集', by: prev.staffName, at: new Date().toISOString() },
        ],
      }
    })
    setEditing(false)
  }

  const handleSubmit = () => {
    setShift(prev => {
      if (!prev) return prev
      return {
        ...prev,
        date: editDate,
        startTime: editStartTime,
        endTime: editEndTime,
        projectId: editProjectId,
        projectName: PROJECTS.find(p => p.id === editProjectId)?.name || prev.projectName,
        notes: editNotes,
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
        approvalHistory: [
          ...prev.approvalHistory,
          { action: '再申請', by: prev.staffName, at: new Date().toISOString() },
        ],
      }
    })
    setEditing(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="シフト詳細"
        description={`ID: ${shift.id}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/shifts')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              シフト一覧に戻る
            </Button>
            {canEdit && !editing && (
              <Button size="sm" onClick={() => setEditing(true)}>
                編集
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">シフト情報</CardTitle>
                <Badge
                  variant="outline"
                  className={cn('border', statusConfig.bgColor, statusConfig.color)}
                >
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="space-y-2">
                    <Label>勤務日</Label>
                    <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>開始時間</Label>
                      <Input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>終了時間</Label>
                      <Input type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>プロジェクト</Label>
                    <Select value={editProjectId} onValueChange={setEditProjectId}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECTS.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>備考</Label>
                    <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} />
                  </div>
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => setEditing(false)}>
                      キャンセル
                    </Button>
                    <Button variant="outline" onClick={handleSave}>
                      <Save className="h-4 w-4 mr-1" />
                      下書き保存
                    </Button>
                    <Button onClick={handleSubmit}>
                      <Send className="h-4 w-4 mr-1" />
                      {shift.status === 'NEEDS_REVISION' ? '再申請' : '申請する'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">スタッフ</p>
                        <p className="text-sm font-medium">{shift.staffName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">プロジェクト</p>
                        <p className="text-sm font-medium">{shift.projectName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">勤務日</p>
                        <p className="text-sm font-medium">{formatDateJP(shift.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">勤務時間</p>
                        <p className="text-sm font-medium">{shift.startTime} - {shift.endTime}</p>
                      </div>
                    </div>
                  </div>
                  {shift.notes && (
                    <div className="border-t pt-3 mt-3">
                      <p className="text-xs text-muted-foreground mb-1">備考</p>
                      <p className="text-sm">{shift.notes}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Approval History Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">承認履歴</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-4">
                {shift.approvalHistory.map((event, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'w-3 h-3 rounded-full shrink-0 mt-1',
                        event.action.includes('承認') || event.action.includes('同期') ? 'bg-green-500' :
                        event.action.includes('却下') ? 'bg-red-500' :
                        event.action.includes('修正') ? 'bg-orange-500' :
                        event.action.includes('申請') ? 'bg-amber-500' :
                        'bg-gray-400'
                      )} />
                      {idx < shift.approvalHistory.length - 1 && (
                        <div className="w-px h-full bg-border min-h-[20px]" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium">{event.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.by} - {formatDateTime(event.at)}
                      </p>
                      {event.comment && (
                        <p className="text-xs mt-1 p-2 rounded bg-muted">
                          {event.comment}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Google Calendar Sync Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Googleカレンダー同期</CardTitle>
            </CardHeader>
            <CardContent>
              {shift.googleCalendarSynced ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-green-700">同期済み</span>
                  </div>
                  {shift.googleCalendarEventId && (
                    <p className="text-xs text-muted-foreground">
                      イベントID: {shift.googleCalendarEventId}
                    </p>
                  )}
                  <Button variant="outline" size="sm" className="w-full">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    再同期
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">未同期</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {shift.status === 'APPROVED'
                      ? '承認済みですが、まだ同期されていません'
                      : '承認済みシフトのみGoogleカレンダーに同期されます'
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ステータス</span>
                <Badge
                  variant="outline"
                  className={cn('border', statusConfig.bgColor, statusConfig.color)}
                >
                  {statusConfig.label}
                </Badge>
              </div>
              {shift.submittedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">申請日時</span>
                  <span className="text-xs">{formatDateTime(shift.submittedAt)}</span>
                </div>
              )}
              {shift.approvedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">承認日時</span>
                  <span className="text-xs">{formatDateTime(shift.approvedAt)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">同期状態</span>
                <span className="text-xs">
                  {shift.googleCalendarSynced ? '同期済み' : '未同期'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
