'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Link2,
  Unlink,
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

// --- Demo Data ---

type CalendarStatus = 'connected' | 'disconnected' | 'error'

interface StaffCalendar {
  id: string
  staffName: string
  email: string
  calendarStatus: CalendarStatus
  lastSyncAt: string | null
}

const INITIAL_STAFF_CALENDARS: StaffCalendar[] = [
  { id: '1', staffName: '田中太郎', email: 'tanaka@example.com', calendarStatus: 'connected', lastSyncAt: '2026-03-28T08:00:00' },
  { id: '2', staffName: '佐藤花子', email: 'sato@example.com', calendarStatus: 'connected', lastSyncAt: '2026-03-28T07:30:00' },
  { id: '3', staffName: '鈴木一郎', email: 'suzuki@example.com', calendarStatus: 'error', lastSyncAt: '2026-03-25T10:00:00' },
  { id: '4', staffName: '高橋美咲', email: 'takahashi@example.com', calendarStatus: 'disconnected', lastSyncAt: null },
  { id: '5', staffName: '渡辺健太', email: 'watanabe@example.com', calendarStatus: 'connected', lastSyncAt: '2026-03-28T08:15:00' },
]

// --- Helpers ---

function formatSyncTime(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function StatusBadge({ status }: { status: CalendarStatus }) {
  switch (status) {
    case 'connected':
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          連携済み
        </Badge>
      )
    case 'disconnected':
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <XCircle className="h-3 w-3 mr-1" />
          未連携
        </Badge>
      )
    case 'error':
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          同期エラー
        </Badge>
      )
  }
}

// --- Component ---

export default function ShiftSyncPage() {
  const router = useRouter()
  const [staffCalendars, setStaffCalendars] = useState<StaffCalendar[]>(INITIAL_STAFF_CALENDARS)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)

  const connectedCount = staffCalendars.filter(s => s.calendarStatus === 'connected').length
  const disconnectedCount = staffCalendars.filter(s => s.calendarStatus === 'disconnected').length
  const errorCount = staffCalendars.filter(s => s.calendarStatus === 'error').length

  const handleConnect = (id: string) => {
    setStaffCalendars(prev =>
      prev.map(s =>
        s.id === id
          ? { ...s, calendarStatus: 'connected' as const, lastSyncAt: new Date().toISOString() }
          : s
      )
    )
  }

  const handleDisconnect = (id: string) => {
    setStaffCalendars(prev =>
      prev.map(s =>
        s.id === id
          ? { ...s, calendarStatus: 'disconnected' as const, lastSyncAt: null }
          : s
      )
    )
  }

  const handleResync = async (id: string) => {
    setSyncingId(id)
    // Simulate sync delay
    await new Promise(r => setTimeout(r, 1000))
    setStaffCalendars(prev =>
      prev.map(s =>
        s.id === id
          ? { ...s, calendarStatus: 'connected' as const, lastSyncAt: new Date().toISOString() }
          : s
      )
    )
    setSyncingId(null)
  }

  const handleSyncAll = async () => {
    setSyncingAll(true)
    await new Promise(r => setTimeout(r, 1500))
    setStaffCalendars(prev =>
      prev.map(s =>
        s.calendarStatus === 'connected' || s.calendarStatus === 'error'
          ? { ...s, calendarStatus: 'connected' as const, lastSyncAt: new Date().toISOString() }
          : s
      )
    )
    setSyncingAll(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Googleカレンダー同期設定"
        description="スタッフごとのGoogleカレンダー連携状態を管理します"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/shifts')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              シフト一覧に戻る
            </Button>
            <Button size="sm" onClick={handleSyncAll} disabled={syncingAll}>
              <RefreshCw className={`h-4 w-4 mr-1 ${syncingAll ? 'animate-spin' : ''}`} />
              {syncingAll ? '同期中...' : '全員を同期'}
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
              <p className="text-2xl font-bold">{connectedCount}名</p>
              <p className="text-xs text-muted-foreground">連携済み</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-bold">{disconnectedCount}名</p>
              <p className="text-xs text-muted-foreground">未連携</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{errorCount}名</p>
              <p className="text-xs text-muted-foreground">同期エラー</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {errorCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <p className="text-yellow-800">
            {staffCalendars.filter(s => s.calendarStatus === 'error').map(s => s.staffName).join('、')}
            のカレンダー同期でエラーが発生しています。再同期を実行するか、連携設定を確認してください。
          </p>
        </div>
      )}

      {/* Staff Calendar Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">スタッフ別カレンダー連携状態</CardTitle>
          <CardDescription>
            各スタッフのGoogleカレンダー連携状態と最終同期日時を確認できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>スタッフ名</TableHead>
                <TableHead>メールアドレス</TableHead>
                <TableHead>連携状態</TableHead>
                <TableHead>最終同期</TableHead>
                <TableHead className="text-right">アクション</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffCalendars.map(staff => (
                <TableRow key={staff.id}>
                  <TableCell className="font-medium">{staff.staffName}</TableCell>
                  <TableCell className="text-muted-foreground">{staff.email}</TableCell>
                  <TableCell>
                    <StatusBadge status={staff.calendarStatus} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatSyncTime(staff.lastSyncAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {staff.calendarStatus === 'disconnected' ? (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleConnect(staff.id)}
                        >
                          <Link2 className="h-3.5 w-3.5 mr-1" />
                          連携する
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResync(staff.id)}
                            disabled={syncingId === staff.id}
                          >
                            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncingId === staff.id ? 'animate-spin' : ''}`} />
                            {syncingId === staff.id ? '同期中...' : '再同期'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDisconnect(staff.id)}
                          >
                            <Unlink className="h-3.5 w-3.5 mr-1" />
                            連携解除
                          </Button>
                        </>
                      )}
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
          <CardTitle className="text-base">連携の仕組み</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>各スタッフが自身のGoogleカレンダーに勤務スケジュールを登録します</li>
            <li>システムが定期的にカレンダーのイベントを取得し、シフトデータとして表示します</li>
            <li>カレンダーイベントのタイトルからプロジェクト名を自動判定します</li>
            <li>同期は1時間ごとに自動実行されますが、手動で即時同期も可能です</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
