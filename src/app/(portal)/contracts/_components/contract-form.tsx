'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Check, ChevronLeft, ChevronRight, FileText, User, Settings, Eye, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { contractFormSchema, type ContractFormValues, type TemplateVariable } from '@/lib/validations/contract'
import { useTemplateList } from '@/hooks/use-contracts'
import { useStaffList } from '@/hooks/use-staff'
import { useCreateContract, useUpdateContract } from '@/hooks/use-contracts'
import { ContractPreview, interpolateContent } from './contract-preview'
import { toast } from 'sonner'
import type { Tables } from '@/lib/types/database'

type ContractTemplate = Tables<'contract_templates'>
type Staff = Tables<'staff'>

interface ContractFormProps {
  mode: 'create' | 'edit'
  contractId?: string
  initialData?: Partial<ContractFormValues> & {
    staff?: Staff | null
    template?: ContractTemplate | null
  }
}

const STEPS = [
  { id: 0, label: 'テンプレート選択', icon: FileText },
  { id: 1, label: 'スタッフ選択', icon: User },
  { id: 2, label: '契約詳細入力', icon: Settings },
  { id: 3, label: 'プレビュー', icon: Eye },
  { id: 4, label: '保存', icon: Save },
]

export function ContractForm({ mode, contractId, initialData }: ContractFormProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(
    initialData?.template || null
  )
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(
    initialData?.staff || null
  )
  const [templateSearch, setTemplateSearch] = useState('')
  const [staffSearch, setStaffSearch] = useState('')

  const { data: templatesData } = useTemplateList({ search: templateSearch, is_active: 'true' })
  const { data: staffData } = useStaffList({ search: staffSearch })

  const createContract = useCreateContract()
  const updateContract = useUpdateContract(contractId || '')

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      staff_id: initialData?.staff_id || '',
      template_id: initialData?.template_id || null,
      title: initialData?.title || '',
      content: initialData?.content || '',
      status: initialData?.status || 'draft',
      start_date: initialData?.start_date || '',
      end_date: initialData?.end_date || null,
      variables: initialData?.variables || {},
    },
  })

  const templateVariables: TemplateVariable[] = useMemo(() => {
    if (!selectedTemplate?.variables) return []
    try {
      const vars = selectedTemplate.variables as unknown
      if (Array.isArray(vars)) return vars as TemplateVariable[]
      return []
    } catch {
      return []
    }
  }, [selectedTemplate])

  const generatedContent = useMemo(() => {
    if (!selectedTemplate) return form.getValues('content') || ''
    const vars = form.getValues('variables') || {}
    const enrichedVars: Record<string, unknown> = {
      ...vars,
      staff_name: selectedStaff ? `${selectedStaff.last_name} ${selectedStaff.first_name}` : '',
      start_date: form.getValues('start_date') || '',
      end_date: form.getValues('end_date') || '',
      title: form.getValues('title') || '',
    }
    return interpolateContent(selectedTemplate.content_template, enrichedVars)
  }, [selectedTemplate, selectedStaff, form])

  const handleSelectTemplate = useCallback(
    (template: ContractTemplate) => {
      setSelectedTemplate(template)
      form.setValue('template_id', template.id)
      if (!form.getValues('title')) {
        form.setValue('title', template.name)
      }
    },
    [form]
  )

  const handleSelectStaff = useCallback(
    (staff: Staff) => {
      setSelectedStaff(staff)
      form.setValue('staff_id', staff.id)
    },
    [form]
  )

  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 0:
        return true // Template is optional
      case 1:
        return !!selectedStaff
      case 2:
        return !!form.getValues('title') && !!form.getValues('start_date')
      case 3:
        return true
      default:
        return false
    }
  }, [currentStep, selectedStaff, form])

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1 && canProceed()) {
      // When moving from step 2 to 3, generate content
      if (currentStep === 2 && selectedTemplate) {
        const vars = form.getValues('variables') || {}
        const enrichedVars: Record<string, unknown> = {
          ...vars,
          staff_name: selectedStaff ? `${selectedStaff.last_name} ${selectedStaff.first_name}` : '',
          start_date: form.getValues('start_date') || '',
          end_date: form.getValues('end_date') || '',
          title: form.getValues('title') || '',
        }
        const content = interpolateContent(selectedTemplate.content_template, enrichedVars)
        form.setValue('content', content)
      }
      setCurrentStep((prev) => prev + 1)
    }
  }, [currentStep, canProceed, selectedTemplate, selectedStaff, form])

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }, [currentStep])

  const handleSave = useCallback(async () => {
    const values = form.getValues()

    // Ensure content is generated
    if (selectedTemplate && !values.content) {
      const vars = values.variables || {}
      const enrichedVars: Record<string, unknown> = {
        ...vars,
        staff_name: selectedStaff ? `${selectedStaff.last_name} ${selectedStaff.first_name}` : '',
        start_date: values.start_date || '',
        end_date: values.end_date || '',
        title: values.title || '',
      }
      values.content = interpolateContent(selectedTemplate.content_template, enrichedVars)
    }

    try {
      if (mode === 'create') {
        const result = await createContract.mutateAsync(values)
        toast.success('契約を作成しました')
        router.push(`/contracts/${result.id}`)
      } else if (contractId) {
        await updateContract.mutateAsync(values)
        toast.success('契約を更新しました')
        router.push(`/contracts/${contractId}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存に失敗しました')
    }
  }, [form, mode, contractId, selectedTemplate, selectedStaff, createContract, updateContract, router])

  return (
    <div className="space-y-6">
      {/* Step Progress */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const StepIcon = step.icon
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep

          return (
            <div key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (index <= currentStep) setCurrentStep(index)
                  }}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                    isCompleted && 'cursor-pointer border-green-500 bg-green-500 text-white',
                    isCurrent && 'border-blue-500 bg-blue-50 text-blue-600',
                    !isCompleted && !isCurrent && 'border-gray-300 bg-white text-gray-400'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </button>
                <span
                  className={cn(
                    'mt-2 text-xs font-medium',
                    isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 flex-1',
                    index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {/* Step 0: Template Selection */}
        {currentStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>テンプレート選択</CardTitle>
              <CardDescription>
                契約書のテンプレートを選択してください。テンプレートなしでも作成できます。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="テンプレートを検索..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {/* No template option */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(null)
                    form.setValue('template_id', null)
                  }}
                  className={cn(
                    'rounded-lg border p-4 text-left transition-colors hover:bg-gray-50',
                    !selectedTemplate && 'border-blue-500 bg-blue-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <span className="font-medium">テンプレートなし</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    自由に契約内容を入力します
                  </p>
                </button>

                {templatesData?.data?.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelectTemplate(template)}
                    className={cn(
                      'rounded-lg border p-4 text-left transition-colors hover:bg-gray-50',
                      selectedTemplate?.id === template.id && 'border-blue-500 bg-blue-50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">{template.name}</span>
                    </div>
                    {template.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {template.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      変数数: {Array.isArray(template.variables) ? (template.variables as unknown[]).length : 0}
                    </p>
                  </button>
                ))}
              </div>

              {/* Template Preview */}
              {selectedTemplate && (
                <div className="mt-4 rounded-lg border bg-gray-50 p-4">
                  <h4 className="mb-2 text-sm font-medium">テンプレートプレビュー</h4>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-gray-600">
                    {selectedTemplate.content_template}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 1: Staff Selection */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>スタッフ選択</CardTitle>
              <CardDescription>契約対象のスタッフを選択してください。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="スタッフを検索（名前、メール）..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
              />
              <div className="max-h-96 space-y-2 overflow-auto">
                {staffData?.data?.map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => handleSelectStaff(staff)}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-lg border p-3 text-left transition-colors hover:bg-gray-50',
                      selectedStaff?.id === staff.id && 'border-blue-500 bg-blue-50'
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium">
                      {staff.last_name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{staff.last_name} {staff.first_name}</div>
                      <div className="text-xs text-muted-foreground">{staff.email}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{staff.employment_type}</div>
                    {selectedStaff?.id === staff.id && (
                      <Check className="h-5 w-5 text-blue-500" />
                    )}
                  </button>
                ))}
                {staffData?.data?.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    スタッフが見つかりません
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Contract Details */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>契約詳細入力</CardTitle>
              <CardDescription>
                契約の基本情報と変数を入力してください。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="title">タイトル *</Label>
                  <Input
                    id="title"
                    {...form.register('title')}
                    placeholder="業務委託契約書"
                  />
                  {form.formState.errors.title && (
                    <p className="mt-1 text-xs text-red-500">
                      {form.formState.errors.title.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="start_date">開始日 *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    {...form.register('start_date')}
                  />
                  {form.formState.errors.start_date && (
                    <p className="mt-1 text-xs text-red-500">
                      {form.formState.errors.start_date.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="end_date">終了日</Label>
                  <Input
                    id="end_date"
                    type="date"
                    {...form.register('end_date')}
                  />
                </div>
              </div>

              {/* Template Variables */}
              {templateVariables.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">テンプレート変数</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {templateVariables.map((variable) => (
                      <div key={variable.key}>
                        <Label htmlFor={`var-${variable.key}`}>
                          {variable.label}
                          {variable.required && ' *'}
                        </Label>
                        {variable.type === 'textarea' ? (
                          <Textarea
                            id={`var-${variable.key}`}
                            value={String((form.watch('variables') as Record<string, unknown>)?.[variable.key] || variable.default_value || '')}
                            onChange={(e) => {
                              const current = (form.getValues('variables') || {}) as Record<string, unknown>
                              form.setValue('variables', {
                                ...current,
                                [variable.key]: e.target.value,
                              })
                            }}
                            rows={3}
                          />
                        ) : variable.type === 'select' && variable.options ? (
                          <select
                            id={`var-${variable.key}`}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={String((form.watch('variables') as Record<string, unknown>)?.[variable.key] || variable.default_value || '')}
                            onChange={(e) => {
                              const current = (form.getValues('variables') || {}) as Record<string, unknown>
                              form.setValue('variables', {
                                ...current,
                                [variable.key]: e.target.value,
                              })
                            }}
                          >
                            <option value="">選択してください</option>
                            {variable.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : variable.type === 'checkbox' ? (
                          <div className="flex items-center gap-2">
                            <input
                              id={`var-${variable.key}`}
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300"
                              checked={Boolean((form.watch('variables') as Record<string, unknown>)?.[variable.key])}
                              onChange={(e) => {
                                const current = (form.getValues('variables') || {}) as Record<string, unknown>
                                form.setValue('variables', {
                                  ...current,
                                  [variable.key]: e.target.checked,
                                })
                              }}
                            />
                            <span className="text-sm">{variable.label}</span>
                          </div>
                        ) : (
                          <Input
                            id={`var-${variable.key}`}
                            type={variable.type === 'number' ? 'number' : variable.type === 'date' ? 'date' : 'text'}
                            value={String((form.watch('variables') as Record<string, unknown>)?.[variable.key] || variable.default_value || '')}
                            onChange={(e) => {
                              const current = (form.getValues('variables') || {}) as Record<string, unknown>
                              form.setValue('variables', {
                                ...current,
                                [variable.key]: e.target.value,
                              })
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Free-form content if no template */}
              {!selectedTemplate && (
                <div>
                  <Label htmlFor="content">契約内容</Label>
                  <Textarea
                    id="content"
                    {...form.register('content')}
                    placeholder="契約内容を入力してください..."
                    rows={12}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Preview */}
        {currentStep === 3 && (
          <ContractPreview
            title={form.getValues('title')}
            content={selectedTemplate ? generatedContent : form.getValues('content') || ''}
            staffName={selectedStaff ? `${selectedStaff.last_name} ${selectedStaff.first_name}` : undefined}
            startDate={form.getValues('start_date')}
            endDate={form.getValues('end_date')}
          />
        )}

        {/* Step 4: Save Confirmation */}
        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>契約の保存</CardTitle>
              <CardDescription>
                以下の内容で契約を{mode === 'create' ? '作成' : '更新'}します。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="grid gap-3 text-sm">
                  <div className="flex gap-2">
                    <span className="w-32 font-medium text-muted-foreground">タイトル:</span>
                    <span>{form.getValues('title')}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-32 font-medium text-muted-foreground">スタッフ:</span>
                    <span>{selectedStaff ? `${selectedStaff.last_name} ${selectedStaff.first_name}` : '未選択'}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-32 font-medium text-muted-foreground">テンプレート:</span>
                    <span>{selectedTemplate?.name || 'なし'}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-32 font-medium text-muted-foreground">開始日:</span>
                    <span>{form.getValues('start_date')}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-32 font-medium text-muted-foreground">終了日:</span>
                    <span>{form.getValues('end_date') || '無期限'}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-32 font-medium text-muted-foreground">ステータス:</span>
                    <span>下書き</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={createContract.isPending || updateContract.isPending}
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                {createContract.isPending || updateContract.isPending
                  ? '保存中...'
                  : mode === 'create'
                    ? '下書きとして保存'
                    : '更新して保存'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          戻る
        </Button>
        {currentStep < STEPS.length - 1 && (
          <Button onClick={handleNext} disabled={!canProceed()}>
            次へ
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
