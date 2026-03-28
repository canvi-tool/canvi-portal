'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Phone,
  Users,
  Plus,
  Trash2,
  Settings,
  Briefcase,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PageHeader } from '@/components/layout/page-header'
import { CallQueueEditor, DEFAULT_BUSINESS_HOURS } from '../../_components/call-queue-editor'
import type { DistributionType } from '../../_components/call-queue-editor'
import { cn } from '@/lib/utils'

// --- Types ---

interface QueueMember {
  id: string
  name: string
  extension: string
  receiveCall: boolean
  status: 'available' | 'busy' | 'offline'
}

interface CallQueueDetail {
  id: string
  name: string
  extension: string
  distributionType: DistributionType
  maxWaitTime: number
  overflowAction: string
  memberCount: number
  linkedProject?: string
  status: 'active' | 'inactive'
}

// --- Demo Data ---

const QUEUE_DATA: Record<string, CallQueueDetail> = {
  cq1: { id: 'cq1', name: 'AIアポブーストキュー', extension: '100', distributionType: 'simultaneous', maxWaitTime: 30, overflowAction: 'voicemail', memberCount: 4, linkedProject: 'AIアポブースト', status: 'active' },
  cq2: { id: 'cq2', name: 'WHITE営業代行キュー', extension: '200', distributionType: 'sequential', maxWaitTime: 45, overflowAction: 'external', memberCount: 3, linkedProject: 'WHITE営業代行', status: 'active' },
  cq3: { id: 'cq3', name: 'ミズテック受電キュー', extension: '300', distributionType: 'longest_idle', maxWaitTime: 60, overflowAction: 'voicemail', memberCount: 5, linkedProject: 'ミズテック受電', status: 'active' },
  cq4: { id: 'cq4', name: 'リクモ架電キュー', extension: '400', distributionType: 'rotating', maxWaitTime: 30, overflowAction: 'disconnect', memberCount: 2, linkedProject: 'リクモ架電PJ', status: 'active' },
}

const QUEUE_MEMBERS: Record<string, QueueMember[]> = {
  cq1: [
    { id: 'm1', name: '佐藤健太', extension: '1001', receiveCall: true, status: 'available' },
    { id: 'm2', name: '田中美咲', extension: '1002', receiveCall: true, status: 'available' },
    { id: 'm3', name: '山田花子', extension: '1003', receiveCall: true, status: 'busy' },
    { id: 'm4', name: '高橋雄太', extension: '1004', receiveCall: false, status: 'offline' },
  ],
  cq2: [
    { id: 'm5', name: '田中美咲', extension: '1002', receiveCall: true, status: 'available' },
    { id: 'm6', name: '佐藤健太', extension: '1001', receiveCall: true, status: 'available' },
    { id: 'm7', name: '伊藤真理', extension: '1005', receiveCall: true, status: 'available' },
  ],
  cq3: [
    { id: 'm8', name: '山田花子', extension: '1003', receiveCall: true, status: 'available' },
    { id: 'm9', name: '渡辺大輔', extension: '1006', receiveCall: true, status: 'available' },
    { id: 'm10', name: '佐藤健太', extension: '1001', receiveCall: true, status: 'busy' },
    { id: 'm11', name: '田中美咲', extension: '1002', receiveCall: false, status: 'offline' },
    { id: 'm12', name: '高橋雄太', extension: '1004', receiveCall: true, status: 'available' },
  ],
  cq4: [
    { id: 'm13', name: '伊藤真理', extension: '1005', receiveCall: true, status: 'available' },
    { id: 'm14', name: '渡辺大輔', extension: '1006', receiveCall: true, status: 'available' },
  ],
}

const AVAILABLE_STAFF = [
  { id: 'as1', name: '中村太郎', extension: '1007' },
  { id: 'as2', name: '小林さくら', extension: '1008' },
  { id: 'as3', name: '加藤翼', extension: '1009' },
]

const DISTRIBUTION_TYPE_LABELS: Record<DistributionType, string> = {
  simultaneous: '同時呼出',
  sequential: '順次呼出',
  rotating: 'ローテーション',
  longest_idle: '最長待機',
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  available: { label: '応対可能', className: 'bg-green-50 text-green-700 border-green-300' },
  busy: { label: '通話中', className: 'bg-amber-50 text-amber-700 border-amber-300' },
  offline: { label: 'オフライン', className: 'bg-gray-100 text-gray-700 border-gray-300' },
}

// --- Component ---

export default function CallQueueDetailPage() {
  const router = useRouter()
  const params = useParams()
  const queueId = params.id as string

  const queue = QUEUE_DATA[queueId]
  const [members, setMembers] = useState<QueueMember[]>(QUEUE_MEMBERS[queueId] || [])
  const [activeTab, setActiveTab] = useState<string>('members')
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [selectedNewMember, setSelectedNewMember] = useState<string>('')

  if (!queue) {
    return (
      <div className="space-y-6">
        <PageHeader title="コールキュー詳細" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            指定されたコールキューが見つかりません。
          </CardContent>
        </Card>
      </div>
    )
  }

  const toggleReceiveCall = (memberId: string) => {
    setMembers(prev =>
      prev.map(m => m.id === memberId ? { ...m, receiveCall: !m.receiveCall } : m)
    )
  }

  const removeMember = (memberId: string) => {
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  const addMember = () => {
    const staff = AVAILABLE_STAFF.find(s => s.id === selectedNewMember)
    if (staff) {
      setMembers(prev => [
        ...prev,
        {
          id: staff.id,
          name: staff.name,
          extension: staff.extension,
          receiveCall: true,
          status: 'available' as const,
        },
      ])
      setSelectedNewMember('')
      setAddMemberOpen(false)
    }
  }

  const availableCount = members.filter(m => m.status === 'available').length
  const receivingCount = members.filter(m => m.receiveCall).length

  return (
    <div className="space-y-6">
      <PageHeader
        title={queue.name}
        description="コールキューの設定とメンバー管理"
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/accounts')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            一覧に戻る
          </Button>
        }
      />

      {/* Queue Info Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <Phone className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-lg font-bold font-mono">{queue.extension}</p>
              <p className="text-xs text-muted-foreground">内線番号</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <Users className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-lg font-bold">{members.length}人</p>
              <p className="text-xs text-muted-foreground">
                応対可能: {availableCount} / 受信ON: {receivingCount}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <Settings className="h-5 w-5 text-indigo-500 shrink-0" />
            <div>
              <p className="text-sm font-bold">{DISTRIBUTION_TYPE_LABELS[queue.distributionType]}</p>
              <p className="text-xs text-muted-foreground">分配方式</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <Briefcase className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-bold">{queue.linkedProject || '-'}</p>
              <p className="text-xs text-muted-foreground">連携PJ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Members / Settings */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="members">メンバー管理</TabsTrigger>
          <TabsTrigger value="settings">キュー設定</TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members">
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <Button size="sm" onClick={() => setAddMemberOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                メンバー追加
              </Button>
            </div>

            <Card>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名前</TableHead>
                      <TableHead>内線番号</TableHead>
                      <TableHead>着信受信</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map(member => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px]">{member.extension}</Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => toggleReceiveCall(member.id)}
                            className={cn(
                              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              member.receiveCall ? 'bg-green-500' : 'bg-gray-300'
                            )}
                          >
                            <span
                              className={cn(
                                'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                                member.receiveCall ? 'translate-x-[18px]' : 'translate-x-[3px]'
                              )}
                            />
                          </button>
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border',
                            STATUS_CONFIG[member.status].className
                          )}>
                            {STATUS_CONFIG[member.status].label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeMember(member.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {members.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          メンバーが登録されていません
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <CallQueueEditor
            distributionType={queue.distributionType}
            maxWaitTime={queue.maxWaitTime}
            overflowAction={queue.overflowAction}
            businessHours={DEFAULT_BUSINESS_HOURS}
            onSave={(data) => {
              // Demo: just log
              console.log('Queue settings saved:', data)
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>メンバー追加</DialogTitle>
            <DialogDescription>
              コールキューに追加するスタッフを選択してください。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">スタッフ選択</label>
              <Select value={selectedNewMember} onValueChange={setSelectedNewMember}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="スタッフを選択..." />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_STAFF.map(staff => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}（内線: {staff.extension}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={addMember} disabled={!selectedNewMember}>
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
