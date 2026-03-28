'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Users,
  UserCheck,
  UserX,
  Clock,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  MoreHorizontal,
  ExternalLink,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/layout/page-header'
import { ProvisionAccountDialog } from './_components/provision-account-dialog'
import { cn } from '@/lib/utils'

// --- Types ---

type AccountStatus = 'active' | 'suspended' | 'pending'
type ZoomLicenseType = 'Basic' | 'Licensed'
type CallDirection = 'inbound' | 'outbound'
type CallResult = 'answered' | 'missed' | 'voicemail'
type DistributionType = 'simultaneous' | 'sequential' | 'rotating' | 'longest_idle'

interface GoogleWorkspaceUser {
  id: string
  name: string
  email: string
  status: AccountStatus
  orgUnit: string
  lastLogin: string
  isAdmin: boolean
}

interface ZoomUser {
  id: string
  name: string
  email: string
  type: ZoomLicenseType
  status: AccountStatus
  lastLogin: string
}

interface CallQueue {
  id: string
  name: string
  extension: string
  memberCount: number
  status: 'active' | 'inactive'
  distributionType: DistributionType
  linkedProject?: string
}

interface PhoneNumber {
  id: string
  number: string
  assignedTo?: string
  assignedType?: 'user' | 'queue'
  status: 'assigned' | 'unassigned'
}

interface CallLog {
  id: string
  date: string
  time: string
  direction: CallDirection
  callerName?: string
  callerNumber: string
  calleeName?: string
  calleeNumber: string
  duration: number // seconds
  result: CallResult
  queue?: string
}

// --- Demo Data ---

const GOOGLE_WORKSPACE_USERS: GoogleWorkspaceUser[] = [
  { id: 'gw1', name: '岡林優治', email: 'okabayashi@canvi.co.jp', status: 'active', orgUnit: '/管理者', lastLogin: '2026-03-28 09:15', isAdmin: true },
  { id: 'gw2', name: '田中美咲', email: 'tanaka@canvi.co.jp', status: 'active', orgUnit: '/管理者', lastLogin: '2026-03-28 08:45', isAdmin: false },
  { id: 'gw3', name: '佐藤健太', email: 'sato@canvi.co.jp', status: 'active', orgUnit: '/スタッフ', lastLogin: '2026-03-28 10:00', isAdmin: false },
  { id: 'gw4', name: '鈴木一郎', email: 'suzuki@canvi.co.jp', status: 'suspended', orgUnit: '/スタッフ', lastLogin: '2026-03-15 17:30', isAdmin: false },
  { id: 'gw5', name: '山田花子', email: 'yamada@canvi.co.jp', status: 'active', orgUnit: '/スタッフ', lastLogin: '2026-03-27 18:20', isAdmin: false },
]

const ZOOM_USERS: ZoomUser[] = [
  { id: 'zm1', name: '岡林優治', email: 'okabayashi@canvi.co.jp', type: 'Licensed', status: 'active', lastLogin: '2026-03-28 09:00' },
  { id: 'zm2', name: '田中美咲', email: 'tanaka@canvi.co.jp', type: 'Licensed', status: 'active', lastLogin: '2026-03-28 08:30' },
  { id: 'zm3', name: '佐藤健太', email: 'sato@canvi.co.jp', type: 'Licensed', status: 'active', lastLogin: '2026-03-28 10:15' },
  { id: 'zm4', name: '鈴木一郎', email: 'suzuki@canvi.co.jp', type: 'Basic', status: 'suspended', lastLogin: '2026-03-15 17:00' },
  { id: 'zm5', name: '山田花子', email: 'yamada@canvi.co.jp', type: 'Licensed', status: 'active', lastLogin: '2026-03-27 18:00' },
]

const CALL_QUEUES: CallQueue[] = [
  { id: 'cq1', name: 'AIアポブーストキュー', extension: '100', memberCount: 4, status: 'active', distributionType: 'simultaneous', linkedProject: 'AIアポブースト' },
  { id: 'cq2', name: 'WHITE営業代行キュー', extension: '200', memberCount: 3, status: 'active', distributionType: 'sequential', linkedProject: 'WHITE営業代行' },
  { id: 'cq3', name: 'ミズテック受電キュー', extension: '300', memberCount: 5, status: 'active', distributionType: 'longest_idle', linkedProject: 'ミズテック受電' },
  { id: 'cq4', name: 'リクモ架電キュー', extension: '400', memberCount: 2, status: 'active', distributionType: 'rotating', linkedProject: 'リクモ架電PJ' },
]

const PHONE_NUMBERS: PhoneNumber[] = [
  { id: 'pn1', number: '03-6205-1001', assignedTo: '岡林優治', assignedType: 'user', status: 'assigned' },
  { id: 'pn2', number: '03-6205-1002', assignedTo: '田中美咲', assignedType: 'user', status: 'assigned' },
  { id: 'pn3', number: '03-6205-1003', assignedTo: '佐藤健太', assignedType: 'user', status: 'assigned' },
  { id: 'pn4', number: '03-6205-1010', assignedTo: 'AIアポブーストキュー', assignedType: 'queue', status: 'assigned' },
  { id: 'pn5', number: '03-6205-1020', assignedTo: 'WHITE営業代行キュー', assignedType: 'queue', status: 'assigned' },
  { id: 'pn6', number: '03-6205-1030', assignedTo: 'ミズテック受電キュー', assignedType: 'queue', status: 'assigned' },
  { id: 'pn7', number: '03-6205-1040', assignedTo: 'リクモ架電キュー', assignedType: 'queue', status: 'assigned' },
  { id: 'pn8', number: '03-6205-1050', status: 'unassigned' },
  { id: 'pn9', number: '03-6205-1051', status: 'unassigned' },
  { id: 'pn10', number: '03-6205-1052', status: 'unassigned' },
]

const CALL_LOGS: CallLog[] = [
  { id: 'cl1', date: '2026-03-28', time: '10:15', direction: 'inbound', callerName: '株式会社ABC', callerNumber: '03-1234-5678', calleeName: '佐藤健太', calleeNumber: '03-6205-1003', duration: 185, result: 'answered', queue: 'AIアポブーストキュー' },
  { id: 'cl2', date: '2026-03-28', time: '10:05', direction: 'outbound', callerName: '田中美咲', callerNumber: '03-6205-1002', calleeName: 'DEF株式会社', calleeNumber: '03-9876-5432', duration: 342, result: 'answered' },
  { id: 'cl3', date: '2026-03-28', time: '09:48', direction: 'inbound', callerNumber: '090-1234-5678', calleeName: '山田花子', calleeNumber: '03-6205-1030', duration: 0, result: 'missed', queue: 'ミズテック受電キュー' },
  { id: 'cl4', date: '2026-03-28', time: '09:30', direction: 'outbound', callerName: '岡林優治', callerNumber: '03-6205-1001', calleeName: 'GHI商事', calleeNumber: '03-5555-1234', duration: 423, result: 'answered' },
  { id: 'cl5', date: '2026-03-28', time: '09:15', direction: 'inbound', callerName: 'JKL工業', callerNumber: '06-1111-2222', calleeName: '佐藤健太', calleeNumber: '03-6205-1010', duration: 267, result: 'answered', queue: 'AIアポブーストキュー' },
  { id: 'cl6', date: '2026-03-27', time: '17:45', direction: 'inbound', callerNumber: '080-9999-8888', calleeNumber: '03-6205-1020', duration: 0, result: 'missed', queue: 'WHITE営業代行キュー' },
  { id: 'cl7', date: '2026-03-27', time: '16:30', direction: 'outbound', callerName: '田中美咲', callerNumber: '03-6205-1002', calleeName: 'MNO株式会社', calleeNumber: '03-3333-4444', duration: 198, result: 'answered' },
  { id: 'cl8', date: '2026-03-27', time: '15:20', direction: 'inbound', callerName: 'PQR建設', callerNumber: '03-7777-8888', calleeName: '山田花子', calleeNumber: '03-6205-1030', duration: 156, result: 'answered', queue: 'ミズテック受電キュー' },
  { id: 'cl9', date: '2026-03-27', time: '14:00', direction: 'outbound', callerName: '佐藤健太', callerNumber: '03-6205-1003', calleeName: 'STU株式会社', calleeNumber: '03-2222-3333', duration: 0, result: 'voicemail' },
  { id: 'cl10', date: '2026-03-27', time: '11:30', direction: 'inbound', callerName: 'VWX商事', callerNumber: '06-5555-6666', calleeName: '岡林優治', calleeNumber: '03-6205-1040', duration: 512, result: 'answered', queue: 'リクモ架電キュー' },
  { id: 'cl11', date: '2026-03-26', time: '16:00', direction: 'outbound', callerName: '山田花子', callerNumber: '03-6205-1030', calleeName: 'YZ株式会社', calleeNumber: '03-4444-5555', duration: 278, result: 'answered' },
  { id: 'cl12', date: '2026-03-26', time: '13:15', direction: 'inbound', callerNumber: '070-1234-5678', calleeNumber: '03-6205-1010', duration: 0, result: 'missed', queue: 'AIアポブーストキュー' },
]

// --- Helpers ---

const DISTRIBUTION_TYPE_LABELS: Record<DistributionType, string> = {
  simultaneous: '同時呼出',
  sequential: '順次呼出',
  rotating: 'ローテーション',
  longest_idle: '最長待機',
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const config = {
    active: { label: '有効', className: 'bg-green-50 text-green-700 border-green-300' },
    suspended: { label: '停止中', className: 'bg-red-50 text-red-700 border-red-300' },
    pending: { label: '保留中', className: 'bg-amber-50 text-amber-700 border-amber-300' },
  }
  const c = config[status]
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border', c.className)}>
      {c.label}
    </span>
  )
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// --- Component ---

export default function AccountsPage() {
  const router = useRouter()
  const [mainTab, setMainTab] = useState<string>('google-workspace')
  const [phoneSubTab, setPhoneSubTab] = useState<string>('call-queues')
  const [gwSearch, setGwSearch] = useState('')
  const [zoomSearch, setZoomSearch] = useState('')
  const [callLogDateFilter, setCallLogDateFilter] = useState<string>('all')
  const [callLogDirectionFilter, setCallLogDirectionFilter] = useState<string>('all')
  const [provisionOpen, setProvisionOpen] = useState(false)
  const [provisionProvider, setProvisionProvider] = useState<'google' | 'zoom'>('google')

  // Google Workspace stats
  const gwActive = GOOGLE_WORKSPACE_USERS.filter(u => u.status === 'active').length
  const gwSuspended = GOOGLE_WORKSPACE_USERS.filter(u => u.status === 'suspended').length
  const gwTotal = GOOGLE_WORKSPACE_USERS.length

  // Zoom stats
  const zmActive = ZOOM_USERS.filter(u => u.status === 'active').length
  const zmSuspended = ZOOM_USERS.filter(u => u.status === 'suspended').length
  const zmTotal = ZOOM_USERS.length
  const zmLicensed = ZOOM_USERS.filter(u => u.type === 'Licensed').length

  // Phone stats
  const pnAssigned = PHONE_NUMBERS.filter(p => p.status === 'assigned').length
  const pnUnassigned = PHONE_NUMBERS.filter(p => p.status === 'unassigned').length

  // Filtered data
  const filteredGwUsers = GOOGLE_WORKSPACE_USERS.filter(u =>
    !gwSearch || u.name.includes(gwSearch) || u.email.includes(gwSearch)
  )

  const filteredZoomUsers = ZOOM_USERS.filter(u =>
    !zoomSearch || u.name.includes(zoomSearch) || u.email.includes(zoomSearch)
  )

  const filteredCallLogs = CALL_LOGS.filter(log => {
    if (callLogDateFilter !== 'all' && log.date !== callLogDateFilter) return false
    if (callLogDirectionFilter !== 'all' && log.direction !== callLogDirectionFilter) return false
    return true
  })

  const uniqueDates = [...new Set(CALL_LOGS.map(l => l.date))].sort().reverse()

  return (
    <div className="space-y-6">
      <PageHeader
        title="アカウント管理"
        description="Google Workspace、Zoom、Zoom Phoneのアカウントを一元管理します。"
      />

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="google-workspace">Google Workspace</TabsTrigger>
          <TabsTrigger value="zoom">Zoom</TabsTrigger>
          <TabsTrigger value="zoom-phone">Zoom Phone</TabsTrigger>
        </TabsList>

        {/* ==================== Google Workspace Tab ==================== */}
        <TabsContent value="google-workspace">
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="flex items-center gap-3 pt-0">
                  <Users className="h-5 w-5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{gwTotal}</p>
                    <p className="text-xs text-muted-foreground">総アカウント数</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 pt-0">
                  <UserCheck className="h-5 w-5 text-green-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{gwActive}</p>
                    <p className="text-xs text-muted-foreground">有効</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 pt-0">
                  <UserX className="h-5 w-5 text-red-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{gwSuspended}</p>
                    <p className="text-xs text-muted-foreground">停止中</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 pt-0">
                  <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-xs text-muted-foreground">保留中</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search + Action */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="名前またはメールで検索..."
                  className="pl-9"
                  value={gwSearch}
                  onChange={e => setGwSearch(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={() => { setProvisionProvider('google'); setProvisionOpen(true) }}>
                <Plus className="h-4 w-4 mr-1" />
                アカウント作成
              </Button>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名前</TableHead>
                      <TableHead>メールアドレス</TableHead>
                      <TableHead>組織部門</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>最終ログイン</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGwUsers.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.name}
                          {user.isAdmin && (
                            <Badge variant="outline" className="ml-2 text-[10px]">管理者</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>{user.orgUnit}</TableCell>
                        <TableCell><StatusBadge status={user.status} /></TableCell>
                        <TableCell className="text-muted-foreground text-xs">{user.lastLogin}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {user.status === 'active' ? (
                                <DropdownMenuItem>アカウント停止</DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem>アカウント再開</DropdownMenuItem>
                              )}
                              <DropdownMenuItem>パスワードリセット</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">削除</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== Zoom Tab ==================== */}
        <TabsContent value="zoom">
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="flex items-center gap-3 pt-0">
                  <Users className="h-5 w-5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{zmTotal}</p>
                    <p className="text-xs text-muted-foreground">総アカウント数</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 pt-0">
                  <UserCheck className="h-5 w-5 text-green-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{zmActive}</p>
                    <p className="text-xs text-muted-foreground">有効</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 pt-0">
                  <UserX className="h-5 w-5 text-red-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{zmSuspended}</p>
                    <p className="text-xs text-muted-foreground">停止中</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 pt-0">
                  <Badge variant="outline" className="text-xs shrink-0">Licensed</Badge>
                  <div>
                    <p className="text-2xl font-bold">{zmLicensed}</p>
                    <p className="text-xs text-muted-foreground">ライセンス付与済</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search + Action */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="名前またはメールで検索..."
                  className="pl-9"
                  value={zoomSearch}
                  onChange={e => setZoomSearch(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={() => { setProvisionProvider('zoom'); setProvisionOpen(true) }}>
                <Plus className="h-4 w-4 mr-1" />
                アカウント作成
              </Button>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名前</TableHead>
                      <TableHead>メールアドレス</TableHead>
                      <TableHead>タイプ</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>最終ログイン</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredZoomUsers.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.type === 'Licensed' ? 'default' : 'outline'} className="text-[10px]">
                            {user.type}
                          </Badge>
                        </TableCell>
                        <TableCell><StatusBadge status={user.status} /></TableCell>
                        <TableCell className="text-muted-foreground text-xs">{user.lastLogin}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>無効化</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">削除</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== Zoom Phone Tab ==================== */}
        <TabsContent value="zoom-phone">
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="flex items-center gap-3 pt-0">
                  <Phone className="h-5 w-5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{CALL_QUEUES.length}</p>
                    <p className="text-xs text-muted-foreground">コールキュー</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 pt-0">
                  <Phone className="h-5 w-5 text-green-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{PHONE_NUMBERS.length}</p>
                    <p className="text-xs text-muted-foreground">電話番号</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 pt-0">
                  <UserCheck className="h-5 w-5 text-green-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{pnAssigned}</p>
                    <p className="text-xs text-muted-foreground">割当済</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 pt-0">
                  <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{pnUnassigned}</p>
                    <p className="text-xs text-muted-foreground">未割当</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sub-tabs */}
            <Tabs value={phoneSubTab} onValueChange={setPhoneSubTab}>
              <TabsList>
                <TabsTrigger value="call-queues">コールキュー</TabsTrigger>
                <TabsTrigger value="phone-numbers">電話番号</TabsTrigger>
                <TabsTrigger value="call-logs">通話ログ</TabsTrigger>
              </TabsList>

              {/* Call Queues */}
              <TabsContent value="call-queues">
                <Card>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>キュー名</TableHead>
                          <TableHead>内線番号</TableHead>
                          <TableHead>メンバー数</TableHead>
                          <TableHead>分配方式</TableHead>
                          <TableHead>ステータス</TableHead>
                          <TableHead>連携PJ</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {CALL_QUEUES.map(queue => (
                          <TableRow key={queue.id}>
                            <TableCell className="font-medium">{queue.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-mono">{queue.extension}</Badge>
                            </TableCell>
                            <TableCell>{queue.memberCount}人</TableCell>
                            <TableCell>
                              <span className="text-xs">{DISTRIBUTION_TYPE_LABELS[queue.distributionType]}</span>
                            </TableCell>
                            <TableCell>
                              <span className={cn(
                                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border',
                                queue.status === 'active'
                                  ? 'bg-green-50 text-green-700 border-green-300'
                                  : 'bg-gray-100 text-gray-700 border-gray-300'
                              )}>
                                {queue.status === 'active' ? '稼働中' : '停止中'}
                              </span>
                            </TableCell>
                            <TableCell>
                              {queue.linkedProject ? (
                                <Badge variant="outline" className="text-[10px]">{queue.linkedProject}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/accounts/call-queues/${queue.id}`)}
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                詳細
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Phone Numbers */}
              <TabsContent value="phone-numbers">
                <Card>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>電話番号</TableHead>
                          <TableHead>割当先</TableHead>
                          <TableHead>種別</TableHead>
                          <TableHead>ステータス</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {PHONE_NUMBERS.map(pn => (
                          <TableRow key={pn.id}>
                            <TableCell className="font-mono font-medium">{pn.number}</TableCell>
                            <TableCell>
                              {pn.assignedTo || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>
                              {pn.assignedType ? (
                                <Badge variant="outline" className="text-[10px]">
                                  {pn.assignedType === 'user' ? 'ユーザー' : 'キュー'}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className={cn(
                                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border',
                                pn.status === 'assigned'
                                  ? 'bg-green-50 text-green-700 border-green-300'
                                  : 'bg-amber-50 text-amber-700 border-amber-300'
                              )}>
                                {pn.status === 'assigned' ? '割当済' : '未割当'}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Call Logs */}
              <TabsContent value="call-logs">
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Select value={callLogDateFilter} onValueChange={setCallLogDateFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="全日付" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全日付</SelectItem>
                        {uniqueDates.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={callLogDirectionFilter} onValueChange={setCallLogDirectionFilter}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="全方向" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全方向</SelectItem>
                        <SelectItem value="inbound">受信</SelectItem>
                        <SelectItem value="outbound">発信</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Card>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>日時</TableHead>
                            <TableHead>方向</TableHead>
                            <TableHead>発信元</TableHead>
                            <TableHead>着信先</TableHead>
                            <TableHead>通話時間</TableHead>
                            <TableHead>結果</TableHead>
                            <TableHead>キュー</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCallLogs.map(log => (
                            <TableRow key={log.id}>
                              <TableCell className="text-xs">
                                <div>{log.date}</div>
                                <div className="text-muted-foreground">{log.time}</div>
                              </TableCell>
                              <TableCell>
                                {log.direction === 'inbound' ? (
                                  <span className="inline-flex items-center gap-1 text-blue-600 text-xs">
                                    <PhoneIncoming className="h-3.5 w-3.5" />
                                    受信
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                                    <PhoneOutgoing className="h-3.5 w-3.5" />
                                    発信
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                <div>{log.callerName || '-'}</div>
                                <div className="text-muted-foreground font-mono">{log.callerNumber}</div>
                              </TableCell>
                              <TableCell className="text-xs">
                                <div>{log.calleeName || '-'}</div>
                                <div className="text-muted-foreground font-mono">{log.calleeNumber}</div>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{formatDuration(log.duration)}</TableCell>
                              <TableCell>
                                {log.result === 'answered' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border bg-green-50 text-green-700 border-green-300">応答</span>
                                )}
                                {log.result === 'missed' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-red-50 text-red-700 border-red-300">
                                    <PhoneMissed className="h-3 w-3" />
                                    不在
                                  </span>
                                )}
                                {log.result === 'voicemail' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border bg-amber-50 text-amber-700 border-amber-300">留守電</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {log.queue ? (
                                  <Badge variant="outline" className="text-[10px]">{log.queue}</Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">直通</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
      </Tabs>

      {/* Provision Dialog */}
      <ProvisionAccountDialog
        open={provisionOpen}
        onOpenChange={setProvisionOpen}
        defaultProvider={provisionProvider}
      />
    </div>
  )
}
