'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarDays,
  Clock,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/layout/page-header'

// --- Types ---

type SyncStatus = 'synced' | 'pending' | 'error' | 'not_approved'

interface SyncedShift {
  id: string
  staffName: string
  projectName: string
  date: string
  startTime: string
  endTime: string
  syncStatus: SyncStatus
  googleCalendarEventId?: string
  lastSyncAt?: string
  errorMessage?: string
}

// --- Demo Data ---

const today = new Date()
function dayOffset(offset: number): string {
  const d = new Date(today)
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const INITIAL_SYNCED_SHIFTS: SyncedShift[] = [
  {
    id: '1',
    staffName: '佐藤健太',
    projectName: 'AIアポブースト',
    date: dayOffset(0),
    startTime: '09:00',
    endTime: '18:00',
    syncStatus: 'synced',
    googleCalendarEventId: 'gcal_abc123',
    lastSyncAt: dayOffset(0) + 'T08:01:00',
  },
  {
    id: '3',
    staffName: '鈴木一郎',
    projectName: 'ミズテック受電',
    date: dayOffset(0),
    startTime: '09:00',
    endTime: '17:00',
    syncStatus: 'synced',
    googleCalendarEventId: 'gcal_def456',
    lastSyncAt: dayOffset(-1) + 'T18:05:00',
  },
  {
    id: '4',
    staffName: '山田花子',
    projectName: 'AIアポブースト',
    date: dayOffset(0),
    startTime: '13:00',
    endTime: '22:00',
    syncStatus: 'error',
    errorMessage: 'Google Calendar API rate limit exceeded. Retry scheduled.',
    lastSyncAt: dayOffset(0) + 'T07:30:00',
  },
  {
    id: '6',
    staffName: '佐藤健太',
    projectName: 'WHITE営業代行',
    date: dayOffset(-1),
    startTime: '09:00',
    endTime: '18:00',
    syncStatus: 'synced',
    googleCalendarEventId: 'gcal_ghi789',
    lastSyncAt: dayOffset(-1) + 'T10:02:00',
  },
  {
    id: '8',
    staffName: '鈴木一郎',
    projectName: 'AIアポブースト',
    date: dayOffset(-1),
    startTime: '09:00',
    endTime: '18:00',
    syncStatus: 'synced',
    googleCalendarEventId: 'gcal_jkl012',
    lastSyncAt: dayOffset(-2) + 'T18:03:00',
  },
  {
    id: '10',
    staffName: '佐藤健太',
    projectName: 'AIアポブースト',
    date: dayOffset(-2),
    startTime: '09:00',
    endTime: '18:00',
    syncStatus: 'synced',
    googleCalendarEventId: 'gcal_mno345',
    lastSyncAt: dayOffset(-3) + 'T18:01:00',
  },
  {
    id: '11',
    staffName: '山田花子',
    projectName: 'ミズテック受電',
    date: dayOffset(-2),
    startTime: '10:00',
    endTime: '19:00',
    syncStatus: 'pending',
    lastSyncAt: dayOffset(-2) + 'T09:05:00',
  },
  {
    id: '16',
    staffName: '田中美咲',
    projectName: 'AIアポブースト',
    date: dayOffset(1),
    startTime: '09:00',
    endTime: '18:00',
    syncStatus: 'synced',
    googleCalendarEventId: 'gcal_pqr678',
    lastSyncAt: dayOffset(0) + 'T08:00:00',
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

function SyncStatusBadge({ status }: { status: SyncStatus }) {
  switch (status) {
    case 'synced':
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          同期済み
        </Badge>
      )
    case 'pending':
      return (
        <Badge variant="default" className="bg-amber-100 text-amber-800 border-amber-200">
          <Clock className="h-3 w-3 mr-1" />
          同期待ち
        </Badge>
      )
    case 'error':
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          エラー
        </Badge>
      )
    case 'not_approved':
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <XCircle className="h-3 w-3 mr-1" />
          未承認
        </Badge>
      )
  }
}

// --- Component ---

export default function ShiftSyncPage() {
  const router = useRouter()
  const [shifts, setShifts] = useState<SyncedShift[]>(INITIAL_SYNCED_SHIFTS)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)

  const syncedCount = shifts.filter(s => s.syncStatus === 'synced').length
  const pendingCount = shifts.filter(s => s.syncStatus === 'pending').length
  const errorCount = shifts.filter(s => s.syncStatus === 'error').length

  const handleResync = async (id: string) => {
    setSyncingId(id)
    await new Promise(r => setTimeout(r, 1000))
    setShifts(prev =>
      prev.map(s =>
        s.id === id
          ? { ...s, syncStatus: 'synced' as const, lastSyncAt: new Date().toISOString(), errorMessage: undefined, googleCalendarEventId: s.googleCalendarEventId || `gcal_resync_${id}` }
          : s
      )
    )
    setSyncingId(null)
  }

  const handleSyncAll = async () => {
    setSyncingAll(true)
    await new Promise(r => setTimeout(r, 1500))
    setShifts(prev =>
      prev.map(s =>
        s.syncStatus === 'error' || s.syncStatus === 'pending'
          ? { ...s, syncStatus: 'synced' as const, lastSyncAt: new Date().toISOString(), errorMessage: undefined, googleCalendarEventId: s.googleCalendarEventId || `gcal_bulk_${s.id}` }
          : s
      )
    )
    setSyncingAll(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Googleカレンダー同期状況"
        description="承認済みシフトのGoogleカレンダー同期状態を確認できます。承認済みシフトのみが同期対象です。"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/shifts')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              シフト一覧に戻る
            </Button>
            <Button size="sm" onClick={handleSyncAll} disabled={syncingAll}>
              <RefreshCw className={`h-4 w-4 mr-1 ${syncingAll ? 'animate-spin' : ''}`} />
              {syncingAll ? '同期中...' : '全て再同期'}
            </Button>
          </div>
        }
      />

      {/* Status Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{syncedCount}件</p>
              <p className="text-xs text-muted-foreground">同期済み</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <Clock className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{pendingCount}件</p>
              <p className="text-xs text-muted-foreground">同期待ち</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{errorCount}件</p>
              <p className="text-xs text-muted-foreground">同期エラー</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {errorCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-red-800">同期エラーが発生しています</p>
            <p className="text-red-700">
              {errorCount}件のシフトでGoogleカレンダーへの同期に失敗しています。再同期を実行してください。
            </p>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
        <CalendarDays className="h-5 w-5 text-blue-600 shrink-0" />
        <p className="text-blue-800">
          <span className="font-medium">承認済みシフトのみ</span>がGoogleカレンダーに同期されます。
          下書き・申請中・却下・修正依頼のシフトは同期されません。
        </p>
      </div>

      {/* Sync Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">承認済みシフト同期一覧</CardTitle>
          <CardDescription>
            各承認済みシフトのGoogleカレンダー同期状態を確認できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>スタッフ</TableHead>
                <TableHead>プロジェクト</TableHead>
                <TableHead>日付</TableHead>
                <TableHead>時間</TableHead>
                <TableHead>同期状態</TableHead>
                <TableHead>最終同期</TableHead>
                <TableHead className="text-right">アクション</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map(shift => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">{shift.staffName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{shift.projectName}</Badge>
                  </TableCell>
                  <TableCell>{formatDateJP(shift.date)}</TableCell>
                  <TableCell>{shift.startTime} - {shift.endTime}</TableCell>
                  <TableCell>
                    <SyncStatusBadge status={shift.syncStatus} />
                    {shift.errorMessage && (
                      <p className="text-[10px] text-red-600 mt-1 max-w-[200px] truncate">
                        {shift.errorMessage}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {shift.lastSyncAt ? formatDateTime(shift.lastSyncAt) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResync(shift.id)}
                        disabled={syncingId === shift.id}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncingId === shift.id ? 'animate-spin' : ''}`} />
                        {syncingId === shift.id ? '同期中' : '再同期'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">同期の仕組み</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>スタッフがシフトを登録し、申請します</li>
            <li>PMが承認すると、ステータスが「承認済み」になります（自動承認プロジェクトは即時承認）</li>
            <li>承認済みシフトが自動的にGoogleカレンダーに同期されます</li>
            <li>同期は承認後5分以内に実行されます。手動で即時同期も可能です</li>
            <li>却下・修正依頼されたシフトはカレンダーから削除されます</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
