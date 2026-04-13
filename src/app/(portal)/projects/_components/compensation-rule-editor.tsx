'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  compensationRuleFormSchema,
  compensationRuleTypes,
  type CompensationRuleFormValues,
  type CompensationRuleTypeValue,
} from '@/lib/validations/assignment'
import { COMPENSATION_RULE_TYPE_LABELS } from '@/lib/constants'
import type { CompensationRule } from '@/hooks/use-projects'
import { Loader2, Plus, Trash2, GripVertical, Pencil } from 'lucide-react'

// ---- Dynamic Params Fields ----

interface ParamsFieldsProps {
  ruleType: CompensationRuleTypeValue
  params: Record<string, unknown>
  onChange: (params: Record<string, unknown>) => void
  errors?: Record<string, string>
  existingRules?: CompensationRule[]
}

function ParamsFields({ ruleType, params, onChange, errors, existingRules }: ParamsFieldsProps) {
  const updateParam = (key: string, value: unknown) => {
    onChange({ ...params, [key]: value })
  }

  switch (ruleType) {
    case 'time_rate':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              時間単価 (円) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min={0}
              value={params.rate_per_hour as number ?? ''}
              onChange={(e) => updateParam('rate_per_hour', e.target.value)}
              placeholder="例: 1500"
            />
            {errors?.rate_per_hour && (
              <p className="text-sm text-destructive">{errors.rate_per_hour}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>残業倍率</Label>
            <Input
              type="number"
              min={1}
              step={0.01}
              value={params.overtime_multiplier as number ?? ''}
              onChange={(e) => updateParam('overtime_multiplier', e.target.value)}
              placeholder="例: 1.25"
            />
            {errors?.overtime_multiplier && (
              <p className="text-sm text-destructive">{errors.overtime_multiplier}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>残業基準時間 (時間)</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={params.overtime_threshold_hours as number ?? ''}
              onChange={(e) => updateParam('overtime_threshold_hours', e.target.value)}
              placeholder="例: 160"
            />
            {errors?.overtime_threshold_hours && (
              <p className="text-sm text-destructive">{errors.overtime_threshold_hours}</p>
            )}
          </div>
        </div>
      )

    case 'count_rate':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              単位名 <span className="text-destructive">*</span>
            </Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={(params.unit_name as string) ?? ''}
              onChange={(e) => updateParam('unit_name', e.target.value)}
            >
              <option value="">選択してください</option>
              <optgroup label="テレアポ系">
                <option value="架電数">架電数</option>
                <option value="アポ数">アポ数</option>
                <option value="通電数">通電数</option>
              </optgroup>
              <optgroup label="インバウンド系">
                <option value="受電数">受電数</option>
                <option value="対応完了数">対応完了数</option>
              </optgroup>
              <optgroup label="ISR/SDR系">
                <option value="即時架電数">即時架電数</option>
                <option value="通常架電数">通常架電数</option>
                <option value="Slack通知数">Slack通知数</option>
                <option value="契約件数">契約件数</option>
              </optgroup>
              <optgroup label="その他">
                <option value="勤務日数">勤務日数</option>
                <option value="日報件数">日報件数</option>
                <option value="シフト数">シフト数</option>
              </optgroup>
            </select>
            {errors?.unit_name && (
              <p className="text-sm text-destructive">{errors.unit_name}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>
              単価 (円) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min={0}
              value={params.rate_per_unit as number ?? ''}
              onChange={(e) => updateParam('rate_per_unit', e.target.value)}
              placeholder="例: 500"
            />
            {errors?.rate_per_unit && (
              <p className="text-sm text-destructive">{errors.rate_per_unit}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>最低件数</Label>
            <Input
              type="number"
              min={0}
              value={params.minimum_count as number ?? ''}
              onChange={(e) => updateParam('minimum_count', e.target.value)}
              placeholder="例: 10"
            />
            {errors?.minimum_count && (
              <p className="text-sm text-destructive">{errors.minimum_count}</p>
            )}
          </div>
        </div>
      )

    case 'standby_rate':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>時間単価 (円)</Label>
            <Input
              type="number"
              min={0}
              value={params.rate_per_hour as number ?? ''}
              onChange={(e) => updateParam('rate_per_hour', e.target.value)}
              placeholder="例: 500"
            />
            {errors?.rate_per_hour && (
              <p className="text-sm text-destructive">{errors.rate_per_hour}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>日額 (円)</Label>
            <Input
              type="number"
              min={0}
              value={params.rate_per_day as number ?? ''}
              onChange={(e) => updateParam('rate_per_day', e.target.value)}
              placeholder="例: 3000"
            />
            {errors?.rate_per_day && (
              <p className="text-sm text-destructive">{errors.rate_per_day}</p>
            )}
          </div>
        </div>
      )

    case 'monthly_fixed':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              月額 (円) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min={0}
              value={params.amount as number ?? ''}
              onChange={(e) => updateParam('amount', e.target.value)}
              placeholder="例: 200000"
            />
            {errors?.amount && (
              <p className="text-sm text-destructive">{errors.amount}</p>
            )}
          </div>
        </div>
      )

    case 'fixed_plus_variable':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              固定額 (円) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min={0}
              value={params.fixed_amount as number ?? ''}
              onChange={(e) => updateParam('fixed_amount', e.target.value)}
              placeholder="例: 100000"
            />
            {errors?.fixed_amount && (
              <p className="text-sm text-destructive">{errors.fixed_amount}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>
              変動単位名 <span className="text-destructive">*</span>
            </Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={(params.variable_unit as string) ?? ''}
              onChange={(e) => updateParam('variable_unit', e.target.value)}
            >
              <option value="">選択してください</option>
              <optgroup label="テレアポ系">
                <option value="架電数">架電数</option>
                <option value="アポ数">アポ数</option>
                <option value="通電数">通電数</option>
              </optgroup>
              <optgroup label="インバウンド系">
                <option value="受電数">受電数</option>
                <option value="対応完了数">対応完了数</option>
              </optgroup>
              <optgroup label="ISR/SDR系">
                <option value="即時架電数">即時架電数</option>
                <option value="通常架電数">通常架電数</option>
                <option value="Slack通知数">Slack通知数</option>
                <option value="契約件数">契約件数</option>
              </optgroup>
              <optgroup label="その他">
                <option value="勤務日数">勤務日数</option>
                <option value="日報件数">日報件数</option>
                <option value="シフト数">シフト数</option>
              </optgroup>
            </select>
            {errors?.variable_unit && (
              <p className="text-sm text-destructive">{errors.variable_unit}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>
              変動単価 (円) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min={0}
              value={params.variable_rate as number ?? ''}
              onChange={(e) => updateParam('variable_rate', e.target.value)}
              placeholder="例: 1000"
            />
            {errors?.variable_rate && (
              <p className="text-sm text-destructive">{errors.variable_rate}</p>
            )}
          </div>
        </div>
      )

    case 'percentage':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              基準ルール <span className="text-destructive">*</span>
            </Label>
            <Select
              value={(params.base_rule_id as string) ?? ''}
              onValueChange={(val) => val && updateParam('base_rule_id', val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="基準ルールを選択" />
              </SelectTrigger>
              <SelectContent>
                {(existingRules || [])
                  .filter((r) => r.rule_type !== 'percentage' && r.rule_type !== 'adjustment')
                  .map((rule) => (
                    <SelectItem key={rule.id} value={rule.id}>
                      {rule.name} ({COMPENSATION_RULE_TYPE_LABELS[rule.rule_type]})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {errors?.base_rule_id && (
              <p className="text-sm text-destructive">{errors.base_rule_id}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>
              率 (%) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min={0}
              max={1000}
              step={0.1}
              value={params.percentage as number ?? ''}
              onChange={(e) => updateParam('percentage', e.target.value)}
              placeholder="例: 10"
            />
            {errors?.percentage && (
              <p className="text-sm text-destructive">{errors.percentage}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>説明</Label>
            <Input
              value={(params.description as string) ?? ''}
              onChange={(e) => updateParam('description', e.target.value)}
              placeholder="例: インセンティブ"
            />
          </div>
        </div>
      )

    case 'adjustment':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              金額 (円) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              value={params.amount as number ?? ''}
              onChange={(e) => updateParam('amount', e.target.value)}
              placeholder="例: 5000 (マイナスも可)"
            />
            {errors?.amount && (
              <p className="text-sm text-destructive">{errors.amount}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>
              理由 <span className="text-destructive">*</span>
            </Label>
            <Input
              value={(params.reason as string) ?? ''}
              onChange={(e) => updateParam('reason', e.target.value)}
              placeholder="例: 交通費, 特別手当"
            />
            {errors?.reason && (
              <p className="text-sm text-destructive">{errors.reason}</p>
            )}
          </div>
        </div>
      )

    default:
      return null
  }
}

// ---- Rule Summary ----

function getRuleSummary(rule: CompensationRule): string {
  const p = rule.params as Record<string, unknown>
  switch (rule.rule_type) {
    case 'time_rate':
      return `${Number(p.rate_per_hour).toLocaleString('ja-JP')}円/時間`
    case 'count_rate':
      return `${p.unit_name}: ${Number(p.rate_per_unit).toLocaleString('ja-JP')}円/件`
    case 'standby_rate':
      if (p.rate_per_hour) return `${Number(p.rate_per_hour).toLocaleString('ja-JP')}円/時間`
      if (p.rate_per_day) return `${Number(p.rate_per_day).toLocaleString('ja-JP')}円/日`
      return '-'
    case 'monthly_fixed':
      return `${Number(p.amount).toLocaleString('ja-JP')}円/月`
    case 'fixed_plus_variable':
      return `固定 ${Number(p.fixed_amount).toLocaleString('ja-JP')}円 + ${p.variable_unit} ${Number(p.variable_rate).toLocaleString('ja-JP')}円`
    case 'percentage':
      return `${p.percentage}%`
    case 'adjustment':
      return `${Number(p.amount).toLocaleString('ja-JP')}円 (${p.reason})`
    default:
      return '-'
  }
}

// ---- Main Editor Component ----

interface CompensationRuleEditorProps {
  rules: CompensationRule[]
  projectId: string
  assignmentId: string
  onCreateRule: (data: CompensationRuleFormValues) => Promise<void>
  onUpdateRule?: (ruleId: string, data: CompensationRuleFormValues) => Promise<void>
  onDeleteRule?: (ruleId: string) => void
  isCreating?: boolean
  isUpdating?: boolean
  isDeleting?: boolean
}

export function CompensationRuleEditor({
  rules,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
  isCreating = false,
  isUpdating = false,
  isDeleting = false,
}: CompensationRuleEditorProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<CompensationRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [ruleType, setRuleType] = useState<CompensationRuleTypeValue>('time_rate')
  const [ruleParams, setRuleParams] = useState<Record<string, unknown>>({})
  const [paramsErrors, setParamsErrors] = useState<Record<string, string>>({})

  const isEditing = !!editingRule
  const isSaving = isEditing ? isUpdating : isCreating

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CompensationRuleFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(compensationRuleFormSchema) as any,
    defaultValues: {
      rule_type: 'time_rate',
      name: '',
      description: '',
      priority: 0,
      is_active: true,
      effective_from: '',
      effective_until: '',
      params: {},
    },
  })

  const openCreateDialog = () => {
    setEditingRule(null)
    reset({
      rule_type: 'time_rate',
      name: '',
      description: '',
      priority: rules.length,
      is_active: true,
      effective_from: '',
      effective_until: '',
      params: {},
    })
    setRuleType('time_rate')
    setRuleParams({})
    setParamsErrors({})
    setDialogOpen(true)
  }

  const openEditDialog = (rule: CompensationRule) => {
    setEditingRule(rule)
    const rt = (rule.rule_type || 'time_rate') as CompensationRuleTypeValue
    const params = (rule.params as Record<string, unknown>) || {}
    reset({
      rule_type: rt,
      name: rule.name || '',
      description: '',
      priority: rule.priority ?? 0,
      is_active: rule.is_active ?? true,
      effective_from: rule.effective_from || '',
      effective_until: rule.effective_to || '',
      params: params,
    })
    setRuleType(rt)
    setRuleParams(params)
    setParamsErrors({})
    setDialogOpen(true)
  }

  const handleRuleTypeChange = (newType: CompensationRuleTypeValue) => {
    setRuleType(newType)
    setRuleParams({})
    setParamsErrors({})
    setValue('rule_type', newType)
  }

  const onSubmitForm = async (data: CompensationRuleFormValues) => {
    setParamsErrors({})

    const formData: CompensationRuleFormValues = {
      ...data,
      rule_type: ruleType,
      params: ruleParams,
    }

    try {
      if (editingRule && onUpdateRule) {
        await onUpdateRule(editingRule.id, formData)
      } else {
        await onCreateRule(formData)
      }
      setDialogOpen(false)
      setEditingRule(null)
      reset()
      setRuleParams({})
    } catch {
      // Error is handled in the parent component
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">報酬ルール</h4>
        <Button variant="outline" size="sm" onClick={openCreateDialog}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          ルール追加
        </Button>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          報酬ルールが設定されていません
        </p>
      ) : (
        <div className="space-y-2">
          {rules
            .sort((a, b) => a.priority - b.priority)
            .map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{rule.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {COMPENSATION_RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}
                    </Badge>
                    {!rule.is_active && (
                      <Badge variant="secondary" className="text-xs">
                        無効
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getRuleSummary(rule)}
                  </p>
                  {(rule.effective_from || rule.effective_to) && (
                    <p className="text-xs text-muted-foreground">
                      期間: {rule.effective_from || '...'} ~ {rule.effective_to || '...'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onUpdateRule && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEditDialog(rule)}
                      disabled={isUpdating}
                      title="修正"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {onDeleteRule && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(rule.id)}
                      disabled={isDeleting}
                      title="削除"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? '報酬ルールを修正' : '報酬ルールを追加'}</DialogTitle>
            <DialogDescription>
              {isEditing ? '報酬ルールの内容を修正します' : 'このアサインに適用する報酬ルールを設定します'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
            {/* Rule Type */}
            <div className="space-y-2">
              <Label>
                ルールタイプ <span className="text-destructive">*</span>
              </Label>
              <Select
                value={ruleType}
                onValueChange={(val) => val && handleRuleTypeChange(val as CompensationRuleTypeValue)}
              >
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

            {/* Rule Name */}
            <div className="space-y-2">
              <Label>
                ルール名 <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('name')}
                placeholder="例: 基本時給, アポ単価"
                aria-invalid={!!errors.name}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Dynamic Params */}
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-3">
                {COMPENSATION_RULE_TYPE_LABELS[ruleType]} パラメータ
              </p>
              <ParamsFields
                ruleType={ruleType}
                params={ruleParams}
                onChange={setRuleParams}
                errors={paramsErrors}
                existingRules={rules}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>優先度</Label>
              <Input
                type="number"
                min={0}
                {...register('priority')}
                aria-invalid={!!errors.priority}
              />
              <p className="text-xs text-muted-foreground">
                数値が小さいほど先に計算されます
              </p>
            </div>

            {/* Effective Period */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>適用開始日</Label>
                <Input type="date" {...register('effective_from')} />
              </div>
              <div className="space-y-2">
                <Label>適用終了日</Label>
                <Input type="date" {...register('effective_until')} />
              </div>
            </div>

            <DialogFooter>
              <DialogClose render={<button className={buttonVariants({ variant: 'outline' })} />}>
                キャンセル
              </DialogClose>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? '保存' : '追加'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="報酬ルールの削除"
        description="この報酬ルールを削除しますか？この操作は取り消せません。"
        confirmLabel="削除する"
        destructive
        onConfirm={() => {
          if (deleteTarget && onDeleteRule) {
            onDeleteRule(deleteTarget)
            setDeleteTarget(null)
          }
        }}
      />
    </div>
  )
}
