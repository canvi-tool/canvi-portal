'use client'

import { use, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { CompensationRuleEditor } from '../../_components/compensation-rule-editor'

import { ASSIGNMENT_STATUS_LABELS } from '@/lib/validations/assignment'
import type { CompensationRuleFormValues } from '@/lib/validations/assignment'
import {
  useProject,
  useAssignments,
  useCreateAssignment,
  useDeleteAssignment,
  useCompensationRules,
  useCreateCompensationRule,
  useStaffList,
  type ProjectAssignment,
} from '@/hooks/use-projects'
import {
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

// ---- Assignment Detail Card ----

function AssignmentCard({
  assignment,
  projectId,
  isHighlighted,
  onDelete,
  isDeleting,
}: {
  assignment: ProjectAssignment
  projectId: string
  isHighlighted: boolean
  onDelete: (id: string) => void
  isDeleting: boolean
}) {
  const [expanded, setExpanded] = useState(isHighlighted)

  const {
    data: rules,
  } = useCompensationRules(projectId, assignment.id)

  const createRule = useCreateCompensationRule(projectId, assignment.id)

  const handleCreateRule = async (data: CompensationRuleFormValues) => {
    await createRule.mutateAsync(data)
    toast.success('報酬ルールを追加しました')
  }

  return (
    <Card className={isHighlighted ? 'ring-2 ring-primary' : ''}>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">
              {assignment.staff?.full_name ?? '(不明)'}
            </CardTitle>
            {assignment.role && (
              <Badge variant="outline">{assignment.role}</Badge>
            )}
            <StatusBadge
              status={assignment.status}
              labels={ASSIGNMENT_STATUS_LABELS}
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {(assignment.compensation_rules || []).length}件のルール
            </Badge>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        <CardDescription>
          期間: {assignment.start_date}
          {assignment.end_date ? ` ~ ${assignment.end_date}` : ' ~'}
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Compensation Rules */}
            <CompensationRuleEditor
              rules={rules || assignment.compensation_rules || []}
              projectId={projectId}
              assignmentId={assignment.id}
              onCreateRule={handleCreateRule}
              isCreating={createRule.isPending}
            />

            {/* Delete Assignment */}
            <div className="flex justify-end pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(assignment.id)
                }}
                disabled={isDeleting}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                アサインを削除
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ---- Main Page ----

export default function AssignmentsPage({ params }: PageProps) {
  const { id: projectId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')

  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data: assignments, isLoading: assignmentsLoading } = useAssignments(projectId)
  const createAssignment = useCreateAssignment(projectId)
  const deleteAssignment = useDeleteAssignment(projectId)
  const { data: staffList } = useStaffList()

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newStaffId, setNewStaffId] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newStatus, setNewStatus] = useState('active')

  const handleAddAssignment = async () => {
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
      setAddDialogOpen(false)
      setNewStaffId('')
      setNewRole('')
      setNewStartDate('')
      setNewEndDate('')
      setNewStatus('active')
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

  if (projectLoading || assignmentsLoading) {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${project.name} - アサイン管理`}
        description="メンバーのアサインと報酬ルールを管理します"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/projects/${projectId}`)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              プロジェクト詳細
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              メンバー追加
            </Button>
          </div>
        }
      />

      {/* Assignment Cards */}
      {assignments && assignments.length > 0 ? (
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              projectId={projectId}
              isHighlighted={assignment.id === highlightId}
              onDelete={handleDeleteAssignment}
              isDeleting={deleteAssignment.isPending}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <Users className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium">メンバーがいません</p>
                <p className="text-sm text-muted-foreground">
                  メンバーを追加して、報酬ルールを設定しましょう。
                </p>
              </div>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                メンバー追加
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Member Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
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
                      {staff.full_name} ({staff.email})
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
            <Button onClick={handleAddAssignment} disabled={createAssignment.isPending}>
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
