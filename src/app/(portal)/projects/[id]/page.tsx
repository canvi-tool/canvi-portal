'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { AssignmentTable } from '../_components/assignment-table'
import { SlackChannelCombobox } from '../_components/slack-channel-combobox'
import { PROJECT_STATUS_LABELS, COMPENSATION_RULE_TYPE_LABELS, SHIFT_APPROVAL_MODE_LABELS } from '@/lib/constants'
import { DAILY_REPORT_TYPE_LABELS } from '@/lib/validations/daily-report'
import { ASSIGNMENT_STATUS_LABELS } from '@/lib/validations/assignment'
import { useQueryClient } from '@tanstack/react-query'
import {
  projectKeys,
  useProject,
  useAssignments,
  useDeleteAssignment,
  useDeleteProject,
  useStaffList,
} from '@/hooks/use-projects'
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
  NOTIFICATION_CATEGORIES,
  type ProjectNotificationSettings,
  type ToggleSettingKey,
  type NumericSettingKey,
} from '@/hooks/use-notification-settings'
import {
  Pencil,
  Trash2,
  ArrowLeft,
  Calendar,
  Building2,
  Users,
  Plus,
  Loader2,
  FileText,
  ClipboardList,
  CalendarDays,
  Bell,
  Hash,
  Link2,
  Link2Off,
} from 'lucide-react'

interface PageProps {
  params: { id: string }
}

export default function ProjectDetailPage({ params }: PageProps) {
  const { id } = params
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: project, isLoading: projectLoading } = useProject(id)
  const { data: assignments, isLoading: assignmentsLoading } = useAssignments(id)
  const deleteAssignment = useDeleteAssignment(id)
  const deleteProject = useDeleteProject()

  useAuth()
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    fetch('/api/user/current')
      .then((r) => r.json())
      .then((data) => {
        if (data.roles?.includes('owner')) setIsOwner(true)
      })
      .catch(() => {})
  }, [])

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('overview')

  // Add member form state
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set())
  const [staffFilter, setStaffFilter] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newStatus, setNewStatus] = useState('active')
  const [bulkAssigning, setBulkAssigning] = useState(false)

  const { data: staffList } = useStaffList()

  // Slack通知設定
  const { data: notificationSettings, isLoading: notificationLoading } = useNotificationSettings(id)
  const updateNotification = useUpdateNotificationSettings(id)

  const handleDeleteProject = async () => {
    try {
      await deleteProject.mutateAsync(id)
      toast.success('プロジェクトを削除しました')
      router.push('/projects')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'プロジェクトの削除に失敗しました'
      )
    }
  }

  const handleAddMember = async () => {
    if (selectedStaffIds.size === 0 || !newStartDate) {
      toast.error('スタッフと開始日は必須です')
      return
    }
    try {
      setBulkAssigning(true)
      const res = await fetch(`/api/projects/${id}/assignments/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_ids: Array.from(selectedStaffIds),
          role_title: newRole,
          status: newStatus,
          start_date: newStartDate,
          end_date: newEndDate || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'アサインに失敗しました')
      }
      const result = await res.json()
      if (result.created > 0) {
        toast.success(`${result.created}名をアサインしました`)
      }
      if (result.skipped > 0) {
        toast.warning(`${result.skipped}名は既にアサイン済みのためスキップしました`)
      }
      setAddMemberOpen(false)
      resetAddForm()
      queryClient.invalidateQueries({ queryKey: projectKeys.assignments(id) })
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'アサインに失敗しました')
    } finally {
      setBulkAssigning(false)
    }
  }

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      await deleteAssignment.mutateAsync(assignmentId)
      toast.success('アサインを削除しました')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'アサインの削除に失敗しました'
      )
    }
  }

  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaffIds(prev => {
      const next = new Set(prev)
      if (next.has(staffId)) {
        next.delete(staffId)
      } else {
        next.add(staffId)
      }
      return next
    })
  }

  const resetAddForm = () => {
    setSelectedStaffIds(new Set())
    setStaffFilter('')
    setNewRole('')
    setNewStartDate('')
    setNewEndDate('')
    setNewStatus('confirmed')
  }

  const handleToggleNotification = async (
    key: ToggleSettingKey,
    value: boolean
  ) => {
    try {
      await updateNotification.mutateAsync({ [key]: value })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '通知設定の更新に失敗しました'
      )
    }
  }

  const handleNumericChange = async (
    key: NumericSettingKey,
    value: number
  ) => {
    try {
      await updateNotification.mutateAsync({ [key]: value })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '通知設定の更新に失敗しました'
      )
    }
  }

  const handleToggleAllInCategory = async (
    items: { key: ToggleSettingKey }[],
    enable: boolean
  ) => {
    const updates: Partial<ProjectNotificationSettings> = {}
    for (const item of items) {
      updates[item.key] = enable as never
    }
    try {
      await updateNotification.mutateAsync(updates)
      toast.success(enable ? '通知をONにしました' : '通知をOFFにしました')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '通知設定の更新に失敗しました'
      )
    }
  }

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="card" rows={1} />
        <LoadingSkeleton variant="table" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <PageHeader title="プロジェクトが見つかりません" />
        <Button variant="outline" onClick={() => router.push('/projects')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          一覧に戻る
        </Button>
      </div>
    )
  }

  const isCAN = project.project_type === 'CAN'

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={project.name}
        description={project.project_code ? `PJコード: ${project.project_code}` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/projects')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              一覧
            </Button>
            <Button variant="outline" onClick={() => router.push(`/projects/${id}/edit`)}>
              <Pencil className="h-4 w-4 mr-1" />
              編集
            </Button>
            {isOwner && (
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1" />
                削除
              </Button>
            )}
          </div>
        }
      />

      {/* Project Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {!isCAN && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">ステータス</p>
                <StatusBadge status={project.status} labels={PROJECT_STATUS_LABELS} />
              </div>
            )}
            {!isCAN && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  クライアント
                </p>
                <p className="text-sm font-medium">
                  {project.client_name || '-'}
                </p>
              </div>
            )}
            {!isCAN && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  期間
                </p>
                <p className="text-sm font-medium">
                  {project.start_date || '...'} ~ {project.end_date || '...'}
                </p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                メンバー数
              </p>
              <p className="text-sm font-medium">{project.assignment_count ?? 0}名</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {project.slack_channel_id ? (
                  <Link2 className="h-3 w-3 text-green-600" />
                ) : (
                  <Link2Off className="h-3 w-3" />
                )}
                Slack連携
              </p>
              {project.slack_channel_id ? (
                <button
                  onClick={() => setActiveTab('notifications')}
                  className="flex items-center gap-1 text-sm font-medium text-green-600 hover:underline cursor-pointer"
                >
                  <Hash className="h-3 w-3" />
                  {project.slack_channel_name?.replace(/^#/, '') || 'connected'}
                </button>
              ) : (
                <button
                  onClick={() => router.push(`/projects/${id}/edit`)}
                  className="text-sm text-muted-foreground hover:text-primary hover:underline cursor-pointer"
                >
                  未連携 → 設定する
                </button>
              )}
            </div>
          </div>
          {project.description && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-1">説明</p>
              <p className="text-sm whitespace-pre-wrap">{project.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/60 p-1 rounded-lg">
          <TabsTrigger value="overview" className="data-active:bg-white data-active:shadow-sm data-active:font-semibold dark:data-active:bg-zinc-800 px-4 py-1.5 rounded-md transition-all">
            <FileText className="h-3.5 w-3.5 mr-1" />
            概要
          </TabsTrigger>
          <TabsTrigger value="members" className="data-active:bg-white data-active:shadow-sm data-active:font-semibold dark:data-active:bg-zinc-800 px-4 py-1.5 rounded-md transition-all">
            <Users className="h-3.5 w-3.5 mr-1" />
            メンバー
          </TabsTrigger>
          <TabsTrigger value="rules" className="data-active:bg-white data-active:shadow-sm data-active:font-semibold dark:data-active:bg-zinc-800 px-4 py-1.5 rounded-md transition-all">
            <ClipboardList className="h-3.5 w-3.5 mr-1" />
            報酬ルール
          </TabsTrigger>
          <TabsTrigger value="shifts" className="data-active:bg-white data-active:shadow-sm data-active:font-semibold dark:data-active:bg-zinc-800 px-4 py-1.5 rounded-md transition-all">
            <CalendarDays className="h-3.5 w-3.5 mr-1" />
            シフト
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-active:bg-white data-active:shadow-sm data-active:font-semibold dark:data-active:bg-zinc-800 px-4 py-1.5 rounded-md transition-all">
            <Bell className="h-3.5 w-3.5 mr-1" />
            Slack通知
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="space-y-4">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>プロジェクト概要</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">PJコード</p>
                    <p className="text-sm font-mono">{project.project_code || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">PJ名</p>
                    <p className="text-sm font-medium">{project.name}</p>
                  </div>
                  {!isCAN && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">ステータス</p>
                      <StatusBadge status={project.status} labels={PROJECT_STATUS_LABELS} />
                    </div>
                  )}
                  {!isCAN && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">クライアント</p>
                      <p className="text-sm">{project.client_name || '-'}</p>
                    </div>
                  )}
                  {!isCAN && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">開始日</p>
                      <p className="text-sm">{project.start_date || '-'}</p>
                    </div>
                  )}
                  {!isCAN && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">終了日</p>
                      <p className="text-sm">{project.end_date || '-'}</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">作成日</p>
                    <p className="text-sm">{new Date(project.created_at).toLocaleString('ja-JP')}</p>
                  </div>
                </div>
                {project.description && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-1">説明</p>
                    <p className="text-sm whitespace-pre-wrap">{project.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Operational Settings */}
            <Card>
              <CardHeader>
                <CardTitle>運用設定</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      シフト承認モード
                    </p>
                    <div>
                      <Badge
                        variant="secondary"
                        className={
                          project.shift_approval_mode === 'AUTO'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }
                      >
                        {SHIFT_APPROVAL_MODE_LABELS[project.shift_approval_mode || 'AUTO'] || project.shift_approval_mode}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {project.shift_approval_mode === 'APPROVAL'
                          ? 'スタッフが申請 → 管理者が承認'
                          : 'スタッフが登録すると即確定'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      カレンダー表記名
                    </p>
                    <p className="text-sm">
                      {(project.custom_fields as Record<string, string> | null)?.calendar_display_name || project.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Googleカレンダーに登録する際の表示名
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      日報タイプ
                    </p>
                    <p className="text-sm">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {DAILY_REPORT_TYPE_LABELS[(project as any).report_type as keyof typeof DAILY_REPORT_TYPE_LABELS] || (project as any).report_type || '-'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {project.slack_channel_id ? (
                        <Link2 className="h-3 w-3 text-green-600" />
                      ) : (
                        <Link2Off className="h-3 w-3" />
                      )}
                      Slack通知チャンネル
                    </p>
                    {project.slack_channel_id ? (
                      <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {project.slack_channel_name?.replace(/^#/, '') || 'connected'}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">未設定</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>メンバー一覧</CardTitle>
                <CardDescription>
                  このプロジェクトにアサインされたスタッフ
                </CardDescription>
              </div>
              <Button onClick={() => setAddMemberOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                メンバー追加
              </Button>
            </CardHeader>
            <CardContent>
              <AssignmentTable
                assignments={assignments || []}
                projectId={id}
                loading={assignmentsLoading}
                onDelete={handleDeleteAssignment}
                isDeleting={deleteAssignment.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compensation Rules Tab */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>報酬ルール管理</CardTitle>
              <CardDescription>
                各メンバーの報酬ルールは
                <Link
                  href={`/projects/${id}/assignments`}
                  className="text-primary hover:underline mx-1"
                >
                  アサイン管理ページ
                </Link>
                で設定できます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignments && assignments.length > 0 ? (
                <div className="space-y-4">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {assignment.staff ? `${assignment.staff.last_name} ${assignment.staff.first_name}` : '(不明)'}
                          </span>
                          {assignment.role_title && (
                            <Badge variant="outline">{assignment.role_title}</Badge>
                          )}
                        </div>
                        <Link href={`/projects/${id}/assignments?highlight=${assignment.id}`}>
                          <Button variant="outline" size="sm">
                            ルール管理
                          </Button>
                        </Link>
                      </div>
                      {assignment.compensation_rules && assignment.compensation_rules.length > 0 ? (
                        <div className="space-y-1">
                          {assignment.compensation_rules.map((rule) => (
                            <div
                              key={rule.id}
                              className="flex items-center gap-2 text-sm text-muted-foreground"
                            >
                              <Badge variant="outline" className="text-xs">
                                {COMPENSATION_RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}
                              </Badge>
                              <span>{rule.name}</span>
                              {!rule.is_active && (
                                <Badge variant="secondary" className="text-xs">
                                  無効
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          報酬ルール未設定
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  メンバーがアサインされていません
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shifts Tab */}
        <TabsContent value="shifts">
          <Card>
            <CardHeader>
              <CardTitle>シフト管理</CardTitle>
              <CardDescription>
                シフトの管理は
                <Link
                  href={`/shifts?project=${id}`}
                  className="text-primary hover:underline mx-1"
                >
                  シフト管理ページ
                </Link>
                から行えます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                シフトデータはシフト管理ページで確認してください。
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Slack Notification Settings Tab */}
        <TabsContent value="notifications">
          <div className="space-y-4">
            {/* Slack Channel Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Slack通知設定
                </CardTitle>
                <CardDescription>
                  このプロジェクトでどのイベントをSlackに通知するか設定します
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">通知先チャンネル</Label>
                  <SlackChannelCombobox
                    value={project.slack_channel_id || ''}
                    onValueChange={async (channelId, channelName) => {
                      try {
                        // DB旧ステータス→スキーマ用マッピング
                        const DB_TO_UI_STATUS: Record<string, string> = {
                          planning: 'proposing',
                          active: 'active',
                          completed: 'ended',
                          paused: 'ended',
                          archived: 'ended',
                          proposing: 'proposing',
                          ended: 'ended',
                        }
                        const res = await fetch(`/api/projects/${id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            project_type: project.project_type || 'BPO',
                            project_number: project.project_number || '001',
                            project_code: project.project_code || '',
                            name: project.name,
                            description: project.description || '',
                            status: DB_TO_UI_STATUS[project.status] || 'active',
                            client_id: project.client_id || '',
                            client_name: project.client_name || '',
                            start_date: project.start_date || '',
                            end_date: project.end_date || '',
                            slack_channel_id: channelId || '',
                            slack_channel_name: channelName || '',
                            shift_approval_mode: project.shift_approval_mode || 'AUTO',
                            calendar_display_name: (project.custom_fields as Record<string, string> | null)?.calendar_display_name || '',
                          }),
                        })
                        if (!res.ok) throw new Error('更新に失敗しました')
                        queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) })
                        toast.success(channelId ? `チャンネル「#${channelName}」を設定しました` : 'チャンネル連携を解除しました')
                      } catch {
                        toast.error('Slackチャンネルの更新に失敗しました')
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notification Toggles */}
            {notificationLoading ? (
              <LoadingSkeleton variant="card" rows={3} />
            ) : (
              NOTIFICATION_CATEGORIES.map((category) => {
                const allEnabled = category.items.every(
                  (item) => notificationSettings?.[item.key] === true
                )
                const someEnabled = category.items.some(
                  (item) => notificationSettings?.[item.key] === true
                )

                return (
                  <Card key={category.key}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <span>{category.icon}</span>
                          {category.label}
                          <Badge variant="outline" className="text-xs font-normal">
                            {category.items.filter((item) => notificationSettings?.[item.key] === true).length}
                            /{category.items.length}
                          </Badge>
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          disabled={updateNotification.isPending}
                          onClick={() =>
                            handleToggleAllInCategory(category.items, !allEnabled)
                          }
                        >
                          {allEnabled ? 'すべてOFF' : someEnabled ? 'すべてON' : 'すべてON'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="divide-y">
                        {category.items.map((item) => {
                          const isEnabled = notificationSettings?.[item.key] === true
                          return (
                            <div key={item.key} className="py-3 first:pt-0 last:pb-0">
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5 pr-4">
                                  <Label
                                    htmlFor={`notify-${item.key}`}
                                    className="text-sm font-medium cursor-pointer"
                                  >
                                    {item.label}
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    {item.description}
                                  </p>
                                </div>
                                <Switch
                                  id={`notify-${item.key}`}
                                  checked={isEnabled}
                                  disabled={updateNotification.isPending}
                                  onCheckedChange={(checked) =>
                                    handleToggleNotification(item.key, checked)
                                  }
                                />
                              </div>

                              {/* タイミング設定パラメータ */}
                              {item.timingParams && isEnabled && (
                                <div className="mt-3 ml-1 pl-3 border-l-2 border-primary/20 space-y-2.5">
                                  {item.timingParams.map((param) => {
                                    const currentValue = (notificationSettings?.[param.key] as number) ?? 0
                                    return (
                                      <div key={param.key} className="flex items-center gap-3">
                                        <Label
                                          htmlFor={`param-${param.key}`}
                                          className="text-xs text-muted-foreground whitespace-nowrap min-w-[160px]"
                                        >
                                          {param.label}
                                        </Label>
                                        <div className="flex items-center gap-1.5">
                                          <Input
                                            id={`param-${param.key}`}
                                            type="number"
                                            value={currentValue}
                                            min={param.min}
                                            max={param.max}
                                            step={param.step ?? 1}
                                            className="w-20 h-7 text-sm text-center"
                                            disabled={updateNotification.isPending}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value)
                                              if (!isNaN(val)) {
                                                handleNumericChange(param.key, val)
                                              }
                                            }}
                                          />
                                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {param.unit}
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      {isOwner && (
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="プロジェクトの削除"
          description={`「${project.name}」を削除しますか？関連するアサインと報酬ルールも削除されます。この操作は取り消せません。`}
          confirmLabel="削除する"
          destructive
          onConfirm={handleDeleteProject}
        />
      )}

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>メンバー追加</DialogTitle>
            <DialogDescription>
              このプロジェクトに新しいメンバーをアサインします
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                スタッフ <span className="text-destructive">*</span>
                {selectedStaffIds.size > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    {selectedStaffIds.size}名選択中
                  </span>
                )}
              </Label>
              <Input
                placeholder="名前で検索..."
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="h-8 text-sm"
              />
              <ScrollArea className="h-[180px] rounded-md border">
                <div className="p-2 space-y-1">
                  {(() => {
                    const assignedIds = new Set((assignments || []).map(a => a.staff_id))
                    const available = (staffList || [])
                      .filter(s => !assignedIds.has(s.id))
                      .filter(s => {
                        if (!staffFilter) return true
                        const name = `${s.last_name}${s.first_name}${s.email}`
                        return name.toLowerCase().includes(staffFilter.toLowerCase())
                      })
                    if (available.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          対象スタッフがいません
                        </p>
                      )
                    }
                    return available.map(staff => (
                      <label
                        key={staff.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={selectedStaffIds.has(staff.id)}
                          onChange={() => toggleStaffSelection(staff.id)}
                        />
                        <span>{staff.last_name} {staff.first_name}</span>
                        <span className="text-xs text-muted-foreground ml-auto truncate">
                          {staff.email}
                        </span>
                      </label>
                    ))
                  })()}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <Label>役割</Label>
              <Input
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="例: リーダー, オペレーター"
              />
            </div>

            <div className="space-y-2">
              <Label>ステータス</Label>
              <Select value={newStatus} onValueChange={(val) => setNewStatus(val ?? 'active')}>
                <SelectTrigger className="w-full">
                  <SelectValueWithLabel value={newStatus} labels={ASSIGNMENT_STATUS_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {[
                    { value: 'proposed', label: '打診中' },
                    { value: 'active', label: '稼働中' },
                    { value: 'ended', label: '契約終了' },
                  ].map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  開始日 <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>終了日</Label>
                <Input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              キャンセル
            </DialogClose>
            <Button onClick={handleAddMember} disabled={bulkAssigning}>
              {bulkAssigning && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
