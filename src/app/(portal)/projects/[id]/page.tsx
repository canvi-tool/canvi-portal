'use client'

import { use, useState } from 'react'
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
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { AssignmentTable } from '../_components/assignment-table'
import { PROJECT_STATUS_LABELS, COMPENSATION_RULE_TYPE_LABELS } from '@/lib/constants'
import { ASSIGNMENT_STATUS_LABELS } from '@/lib/validations/assignment'
import {
  useProject,
  useAssignments,
  useCreateAssignment,
  useDeleteAssignment,
  useDeleteProject,
  useStaffList,
} from '@/hooks/use-projects'
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
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ProjectDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()

  const { data: project, isLoading: projectLoading } = useProject(id)
  const { data: assignments, isLoading: assignmentsLoading } = useAssignments(id)
  const createAssignment = useCreateAssignment(id)
  const deleteAssignment = useDeleteAssignment(id)
  const deleteProject = useDeleteProject()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('overview')

  // Add member form state
  const [newStaffId, setNewStaffId] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newStatus, setNewStatus] = useState('active')

  const { data: staffList } = useStaffList()

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
    if (!newStaffId || !newStartDate) {
      toast.error('スタッフと開始日は必須です')
      return
    }
    try {
      await createAssignment.mutateAsync({
        staff_id: newStaffId,
        role: newRole,
        status: newStatus as 'pending' | 'active' | 'suspended' | 'ended',
        start_date: newStartDate,
        end_date: newEndDate || undefined,
      })
      toast.success('メンバーを追加しました')
      setAddMemberOpen(false)
      resetAddForm()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'メンバーの追加に失敗しました'
      )
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

  const resetAddForm = () => {
    setNewStaffId('')
    setNewRole('')
    setNewStartDate('')
    setNewEndDate('')
    setNewStatus('active')
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

  const metadata = project.metadata as Record<string, string> | null

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={project.name}
        description={metadata?.project_code ? `PJコード: ${metadata.project_code}` : undefined}
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
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" />
              削除
            </Button>
          </div>
        }
      />

      {/* Project Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">ステータス</p>
              <StatusBadge status={project.status} labels={PROJECT_STATUS_LABELS} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                クライアント
              </p>
              <p className="text-sm font-medium">
                {project.client_name || '-'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                期間
              </p>
              <p className="text-sm font-medium">
                {project.start_date || '...'} ~ {project.end_date || '...'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                メンバー数
              </p>
              <p className="text-sm font-medium">{project.assignment_count ?? 0}名</p>
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
        <TabsList>
          <TabsTrigger value="overview">
            <FileText className="h-3.5 w-3.5 mr-1" />
            概要
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="h-3.5 w-3.5 mr-1" />
            メンバー
          </TabsTrigger>
          <TabsTrigger value="rules">
            <ClipboardList className="h-3.5 w-3.5 mr-1" />
            報酬ルール
          </TabsTrigger>
          <TabsTrigger value="shifts">
            <CalendarDays className="h-3.5 w-3.5 mr-1" />
            シフト
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>プロジェクト概要</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">PJコード</p>
                  <p className="text-sm font-mono">{metadata?.project_code || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">PJ名</p>
                  <p className="text-sm">{project.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">ステータス</p>
                  <StatusBadge status={project.status} labels={PROJECT_STATUS_LABELS} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">クライアント</p>
                  <p className="text-sm">{project.client_name || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">開始日</p>
                  <p className="text-sm">{project.start_date || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">終了日</p>
                  <p className="text-sm">{project.end_date || '-'}</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Google Calendar ID</p>
                  <p className="text-sm font-mono">{metadata?.google_calendar_id || '-'}</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">作成日</p>
                  <p className="text-sm">{new Date(project.created_at).toLocaleString('ja-JP')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
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
                          {assignment.role && (
                            <Badge variant="outline">{assignment.role}</Badge>
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
      </Tabs>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="プロジェクトの削除"
        description={`「${project.name}」を削除しますか？関連するアサインと報酬ルールも削除されます。この操作は取り消せません。`}
        confirmLabel="削除する"
        destructive
        onConfirm={handleDeleteProject}
      />

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
              </Label>
              <Select value={newStaffId} onValueChange={(val) => setNewStaffId(val ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="スタッフを選択" />
                </SelectTrigger>
                <SelectContent>
                  {(staffList || []).map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.last_name} {staff.first_name} ({staff.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ASSIGNMENT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
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
            <Button onClick={handleAddMember} disabled={createAssignment.isPending}>
              {createAssignment.isPending && (
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
