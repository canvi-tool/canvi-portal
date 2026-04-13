'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { CompensationRuleEditor } from '../../_components/compensation-rule-editor'

import { ASSIGNMENT_STATUS_LABELS } from '@/lib/validations/assignment'
import type { CompensationRuleFormValues } from '@/lib/validations/assignment'
import {
  compensationRuleTypes,
  type CompensationRuleTypeValue,
} from '@/lib/validations/assignment'
import { COMPENSATION_RULE_TYPE_LABELS } from '@/lib/constants'
import {
  useProject,
  useAssignments,
  useCreateAssignment,
  useDeleteAssignment,
  useCompensationRules,
  useCreateCompensationRule,
  useUpdateCompensationRule,
  useDeleteCompensationRule,
  useBulkCreateCompensationRule,
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
  Copy,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

interface PageProps {
  params: { id: string }
}

// ---- Assignment Detail Card ----

function AssignmentCard({
  assignment,
  projectId,
  isHighlighted,
  isSelected,
  onSelect,
  onDelete,
  isDeleting,
}: {
  assignment: ProjectAssignment
  projectId: string
  isHighlighted: boolean
  isSelected?: boolean
  onSelect?: (id: string, checked: boolean) => void
  onDelete: (id: string) => void
  isDeleting: boolean
}) {
  const [expanded, setExpanded] = useState(isHighlighted)

  const {
    data: rules,
  } = useCompensationRules(projectId, assignment.id)

  const createRule = useCreateCompensationRule(projectId, assignment.id)
  const updateRule = useUpdateCompensationRule(projectId, assignment.id)
  const deleteRule = useDeleteCompensationRule(projectId, assignment.id)

  const handleCreateRule = async (data: CompensationRuleFormValues) => {
    await createRule.mutateAsync(data)
    toast.success('報酬ルールを追加しました')
  }

  const handleUpdateRule = async (ruleId: string, data: CompensationRuleFormValues) => {
    await updateRule.mutateAsync({ ruleId, data })
    toast.success('報酬ルールを更新しました')
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await deleteRule.mutateAsync(ruleId)
      toast.success('報酬ルールを削除しました')
    } catch {
      toast.error('報酬ルールの削除に失敗しました')
    }
  }

  return (
    <Card className={isHighlighted ? 'ring-2 ring-primary' : ''}>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onSelect && (
              <Checkbox
                checked={isSelected}
                onChange={(e) => onSelect(assignment.id, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <CardTitle className="text-base">
              {assignment.staff ? `${assignment.staff.last_name} ${assignment.staff.first_name}` : '(不明)'}
            </CardTitle>
            {assignment.role_title && (
              <Badge variant="outline">{assignment.role_title}</Badge>
            )}
            <StatusBadge
              status={assignment.status}
              labels={ASSIGNMENT_STATUS_LABELS}
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {(rules || assignment.compensation_rules || []).length}件のルール
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
              onUpdateRule={handleUpdateRule}
              onDeleteRule={handleDeleteRule}
              isCreating={createRule.isPending}
              isUpdating={updateRule.isPending}
              isDeleting={deleteRule.isPending}
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
  const { id: projectId } = params
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')

  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data: assignments, isLoading: assignmentsLoading } = useAssignments(projectId)
  const createAssignment = useCreateAssignment(projectId)
  const deleteAssignment = useDeleteAssignment(projectId)
  const { data: staffList } = useStaffList()

  const bulkCreate = useBulkCreateCompensationRule(projectId)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set())
  const [newStaffId, setNewStaffId] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newStatus, setNewStatus] = useState('active')

  const handleSelectAssignment = (id: string, checked: boolean) => {
    setSelectedAssignmentIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked && assignments) {
      setSelectedAssignmentIds(new Set(assignments.map((a) => a.id)))
    } else {
      setSelectedAssignmentIds(new Set())
    }
  }

  const handleAddAssignment = async () => {
    if (!newStaffId || !newStartDate) {
      toast.error('スタッフと開始日は必須です')
      return
    }
    try {
      await createAssignment.mutateAsync({
        staff_id: newStaffId,
        role_title: newRole,
        status: newStatus as 'proposed' | 'active' | 'ended',
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
            <Button
              variant="outline"
              onClick={() => setBulkDialogOpen(true)}
              disabled={selectedAssignmentIds.size === 0}
            >
              <Copy className="h-4 w-4 mr-1" />
              一括ルール追加 ({selectedAssignmentIds.size})
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
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              checked={assignments.length > 0 && selectedAssignmentIds.size === assignments.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
            <span className="text-sm text-muted-foreground">全て選択</span>
          </div>
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              projectId={projectId}
              isHighlighted={assignment.id === highlightId}
              isSelected={selectedAssignmentIds.has(assignment.id)}
              onSelect={handleSelectAssignment}
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
            <DialogClose render={<button className={buttonVariants({ variant: 'outline' })} />}>
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

      {/* Bulk Rule Add Dialog */}
      <BulkRuleDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedCount={selectedAssignmentIds.size}
        onSubmit={async (data) => {
          try {
            const result = await bulkCreate.mutateAsync({
              assignmentIds: Array.from(selectedAssignmentIds),
              data,
            })
            toast.success(`${result.created}件のアサインにルールを追加しました`)
            setBulkDialogOpen(false)
            setSelectedAssignmentIds(new Set())
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : '一括追加に失敗しました'
            )
          }
        }}
        isLoading={bulkCreate.isPending}
      />
    </div>
  )
}

// ---- Bulk Rule Dialog ----

function BulkRuleDialog({
  open,
  onOpenChange,
  selectedCount,
  onSubmit,
  isLoading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  onSubmit: (data: CompensationRuleFormValues) => Promise<void>
  isLoading: boolean
}) {
  const [ruleType, setRuleType] = useState<CompensationRuleTypeValue>('time_rate')
  const [ruleName, setRuleName] = useState('')
  const [ruleParams, setRuleParams] = useState<Record<string, unknown>>({})
  const [priority, setPriority] = useState(0)
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveUntil, setEffectiveUntil] = useState('')

  const handleSubmit = () => {
    if (!ruleName.trim()) {
      return
    }
    onSubmit({
      rule_type: ruleType,
      name: ruleName,
      params: ruleParams,
      priority,
      is_active: true,
      effective_from: effectiveFrom,
      effective_until: effectiveUntil,
    })
  }

  const resetForm = () => {
    setRuleType('time_rate')
    setRuleName('')
    setRuleParams({})
    setPriority(0)
    setEffectiveFrom('')
    setEffectiveUntil('')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>一括ルール追加</DialogTitle>
          <DialogDescription>
            選択した{selectedCount}件のアサインに同じ報酬ルールを追加します
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>ルールタイプ <span className="text-destructive">*</span></Label>
            <Select value={ruleType} onValueChange={(val) => { setRuleType(val as CompensationRuleTypeValue); setRuleParams({}) }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {compensationRuleTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {COMPENSATION_RULE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ルール名 <span className="text-destructive">*</span></Label>
            <Input
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="例: 基本時給, アポ単価"
            />
          </div>

          <div className="rounded-lg border p-4 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-3">
              {COMPENSATION_RULE_TYPE_LABELS[ruleType]} パラメータ
            </p>
            <BulkParamsFields
              ruleType={ruleType}
              params={ruleParams}
              onChange={setRuleParams}
            />
          </div>

          <div className="space-y-2">
            <Label>優先度</Label>
            <Input
              type="number"
              min={0}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>適用開始日</Label>
              <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>適用終了日</Label>
              <Input type="date" value={effectiveUntil} onChange={(e) => setEffectiveUntil(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<button className={buttonVariants({ variant: 'outline' })} />}>
            キャンセル
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isLoading || !ruleName.trim()}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selectedCount}件に追加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Simplified params fields for bulk dialog (same structure, no existing rules dependency)
function BulkParamsFields({
  ruleType,
  params,
  onChange,
}: {
  ruleType: CompensationRuleTypeValue
  params: Record<string, unknown>
  onChange: (params: Record<string, unknown>) => void
}) {
  const updateParam = (key: string, value: unknown) => {
    onChange({ ...params, [key]: value })
  }

  switch (ruleType) {
    case 'time_rate':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">時間単価 (円) *</Label>
            <Input type="number" min={0} value={params.rate_per_hour as number ?? ''} onChange={(e) => updateParam('rate_per_hour', e.target.value)} placeholder="1500" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">残業倍率</Label>
            <Input type="number" min={1} step={0.01} value={params.overtime_multiplier as number ?? ''} onChange={(e) => updateParam('overtime_multiplier', e.target.value)} placeholder="1.25" />
          </div>
        </div>
      )
    case 'count_rate':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">単位名 *</Label>
            <Input value={(params.unit_name as string) ?? ''} onChange={(e) => updateParam('unit_name', e.target.value)} placeholder="架電件数" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">単価 (円) *</Label>
            <Input type="number" min={0} value={params.rate_per_unit as number ?? ''} onChange={(e) => updateParam('rate_per_unit', e.target.value)} placeholder="500" />
          </div>
        </div>
      )
    case 'standby_rate':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">時間単価 (円)</Label>
            <Input type="number" min={0} value={params.rate_per_hour as number ?? ''} onChange={(e) => updateParam('rate_per_hour', e.target.value)} placeholder="500" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">日額 (円)</Label>
            <Input type="number" min={0} value={params.rate_per_day as number ?? ''} onChange={(e) => updateParam('rate_per_day', e.target.value)} placeholder="3000" />
          </div>
        </div>
      )
    case 'monthly_fixed':
      return (
        <div className="space-y-1">
          <Label className="text-xs">月額 (円) *</Label>
          <Input type="number" min={0} value={params.amount as number ?? ''} onChange={(e) => updateParam('amount', e.target.value)} placeholder="200000" />
        </div>
      )
    case 'fixed_plus_variable':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">固定額 (円) *</Label>
            <Input type="number" min={0} value={params.fixed_amount as number ?? ''} onChange={(e) => updateParam('fixed_amount', e.target.value)} placeholder="100000" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">変動単位名 *</Label>
            <Input value={(params.variable_unit as string) ?? ''} onChange={(e) => updateParam('variable_unit', e.target.value)} placeholder="アポ件数" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">変動単価 (円) *</Label>
            <Input type="number" min={0} value={params.variable_rate as number ?? ''} onChange={(e) => updateParam('variable_rate', e.target.value)} placeholder="1000" />
          </div>
        </div>
      )
    case 'percentage':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">率 (%) *</Label>
            <Input type="number" min={0} max={1000} step={0.1} value={params.percentage as number ?? ''} onChange={(e) => updateParam('percentage', e.target.value)} placeholder="10" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">説明</Label>
            <Input value={(params.description as string) ?? ''} onChange={(e) => updateParam('description', e.target.value)} placeholder="インセンティブ" />
          </div>
        </div>
      )
    case 'adjustment':
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">金額 (円) *</Label>
            <Input type="number" value={params.amount as number ?? ''} onChange={(e) => updateParam('amount', e.target.value)} placeholder="5000" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">理由 *</Label>
            <Input value={(params.reason as string) ?? ''} onChange={(e) => updateParam('reason', e.target.value)} placeholder="交通費" />
          </div>
        </div>
      )
    default:
      return null
  }
}
