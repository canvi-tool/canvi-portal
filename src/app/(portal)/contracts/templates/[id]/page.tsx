'use client'

import { useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronLeft,
  Save,
  Plus,
  Trash2,
  Eye,
  Code,
  Variable,
} from 'lucide-react'
import { useTemplate, useUpdateTemplate, useDeleteTemplate } from '@/hooks/use-contracts'
import { contractTemplateFormSchema, type ContractTemplateFormValues, type TemplateVariable } from '@/lib/validations/contract'
import { interpolateContent } from '../../_components/contract-preview'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const VARIABLE_TYPES: { value: string; label: string }[] = [
  { value: 'text', label: 'テキスト' },
  { value: 'number', label: '数値' },
  { value: 'date', label: '日付' },
  { value: 'select', label: '選択肢' },
  { value: 'checkbox', label: 'チェックボックス' },
  { value: 'textarea', label: 'テキストエリア' },
]

export default function TemplateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: template, isLoading } = useTemplate(id)
  const updateTemplate = useUpdateTemplate(id)
  const deleteTemplate = useDeleteTemplate()

  const [activeTab, setActiveTab] = useState<'edit' | 'variables' | 'preview'>('edit')
  const [sampleData, setSampleData] = useState<Record<string, string>>({})

  const form = useForm<ContractTemplateFormValues>({
    resolver: zodResolver(contractTemplateFormSchema),
    values: template
      ? {
          name: template.name,
          description: template.description || '',
          content_template: template.content_template,
          variables: (Array.isArray(template.variables) ? template.variables : []) as TemplateVariable[],
          is_active: template.is_active,
        }
      : undefined,
  })

  const variables = form.watch('variables') || []
  const contentTemplate = form.watch('content_template') || ''

  const previewContent = useMemo(() => {
    const enrichedData: Record<string, string> = {
      ...sampleData,
      staff_name: sampleData.staff_name || '山田 太郎',
      start_date: sampleData.start_date || '2025-04-01',
      end_date: sampleData.end_date || '2026-03-31',
      title: sampleData.title || 'サンプル契約書',
    }
    return interpolateContent(contentTemplate, enrichedData)
  }, [contentTemplate, sampleData])

  const handleAddVariable = useCallback(() => {
    const current = form.getValues('variables') || []
    form.setValue('variables', [
      ...current,
      {
        key: `var_${current.length + 1}`,
        label: `変数${current.length + 1}`,
        type: 'text' as const,
        required: false,
      },
    ])
  }, [form])

  const handleRemoveVariable = useCallback(
    (index: number) => {
      const current = form.getValues('variables') || []
      form.setValue(
        'variables',
        current.filter((_, i) => i !== index)
      )
    },
    [form]
  )

  const handleUpdateVariable = useCallback(
    (index: number, field: keyof TemplateVariable, value: unknown) => {
      const current = [...(form.getValues('variables') || [])]
      if (current[index]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(current[index] as any)[field] = value
        form.setValue('variables', current)
      }
    },
    [form]
  )

  const handleSave = useCallback(async () => {
    const values = form.getValues()
    const result = contractTemplateFormSchema.safeParse(values)
    if (!result.success) {
      const firstError = result.error.issues[0]
      toast.error(firstError?.message || 'バリデーションエラー')
      return
    }
    try {
      await updateTemplate.mutateAsync(result.data)
      toast.success('テンプレートを保存しました')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存に失敗しました')
    }
  }, [form, updateTemplate])

  const handleDelete = useCallback(async () => {
    if (!window.confirm('このテンプレートを削除しますか？この操作は取り消せません。')) {
      return
    }
    try {
      await deleteTemplate.mutateAsync(id)
      toast.success('テンプレートを削除しました')
      router.push('/contracts/templates')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }, [id, deleteTemplate, router])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="mb-4 text-muted-foreground">テンプレートが見つかりません</p>
        <Button variant="outline" onClick={() => router.push('/contracts/templates')}>
          一覧に戻る
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={template.name}
        description="テンプレートの編集とプレビュー"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/contracts/templates" />}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              一覧に戻る
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteTemplate.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              削除
            </Button>
            <Button onClick={handleSave} disabled={updateTemplate.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateTemplate.isPending ? '保存中...' : '保存'}
            </Button>
          </div>
        }
      />

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">テンプレート名 *</Label>
              <Input id="name" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">説明</Label>
              <Input id="description" {...form.register('description')} placeholder="テンプレートの説明..." />
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="is_active">ステータス</Label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  id="is_active"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={form.watch('is_active')}
                  onChange={(e) => form.setValue('is_active', e.target.checked)}
                />
                <span className="text-sm">有効</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg border bg-muted p-1">
        <button
          type="button"
          onClick={() => setActiveTab('edit')}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'edit'
              ? 'bg-background shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Code className="h-4 w-4" />
          テンプレート本文
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('variables')}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'variables'
              ? 'bg-background shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Variable className="h-4 w-4" />
          変数定義 ({variables.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'preview'
              ? 'bg-background shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Eye className="h-4 w-4" />
          プレビュー
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'edit' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">テンプレート本文</CardTitle>
            <CardDescription>
              {'{{変数名}}'} の形式で変数を埋め込めます。例: {'{{staff_name}}'}, {'{{start_date}}'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              {...form.register('content_template')}
              rows={20}
              className="font-mono text-sm"
              placeholder="契約書テンプレートの本文を入力してください..."
            />
            {form.formState.errors.content_template && (
              <p className="mt-1 text-xs text-red-500">
                {form.formState.errors.content_template.message}
              </p>
            )}

            {/* Quick insert buttons */}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground self-center">変数を挿入:</span>
              {variables.map((v) => (
                <Badge
                  key={v.key}
                  variant="outline"
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    const textarea = document.querySelector<HTMLTextAreaElement>(
                      'textarea[name="content_template"]'
                    )
                    if (textarea) {
                      const start = textarea.selectionStart
                      const end = textarea.selectionEnd
                      const currentValue = form.getValues('content_template')
                      const newValue =
                        currentValue.slice(0, start) + `{{${v.key}}}` + currentValue.slice(end)
                      form.setValue('content_template', newValue)
                      // Focus and set cursor position
                      textarea.focus()
                      const newPos = start + v.key.length + 4
                      setTimeout(() => textarea.setSelectionRange(newPos, newPos), 0)
                    }
                  }}
                >
                  {`{{${v.key}}}`}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'variables' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">変数定義</CardTitle>
            <CardDescription>
              テンプレート内で使用する変数を定義します。{'{{変数キー}}'} の形式で本文に埋め込まれます。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {variables.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                変数が定義されていません
              </p>
            )}

            {variables.map((variable, index) => (
              <div key={index} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium">変数 #{index + 1}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveVariable(index)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    削除
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label>キー *</Label>
                    <Input
                      value={variable.key}
                      onChange={(e) => handleUpdateVariable(index, 'key', e.target.value)}
                      placeholder="variable_key"
                    />
                  </div>
                  <div>
                    <Label>ラベル *</Label>
                    <Input
                      value={variable.label}
                      onChange={(e) => handleUpdateVariable(index, 'label', e.target.value)}
                      placeholder="表示ラベル"
                    />
                  </div>
                  <div>
                    <Label>型</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={variable.type}
                      onChange={(e) => handleUpdateVariable(index, 'type', e.target.value)}
                    >
                      {VARIABLE_TYPES.map((vt) => (
                        <option key={vt.value} value={vt.value}>
                          {vt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-3">
                    <label className="flex items-center gap-2 cursor-pointer pb-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={variable.required}
                        onChange={(e) =>
                          handleUpdateVariable(index, 'required', e.target.checked)
                        }
                      />
                      <span className="text-sm">必須</span>
                    </label>
                  </div>
                </div>

                {/* Options for select type */}
                {variable.type === 'select' && (
                  <div className="mt-3">
                    <Label>選択肢（カンマ区切り）</Label>
                    <Input
                      value={(variable.options || []).join(', ')}
                      onChange={(e) =>
                        handleUpdateVariable(
                          index,
                          'options',
                          e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        )
                      }
                      placeholder="選択肢1, 選択肢2, 選択肢3"
                    />
                  </div>
                )}

                <div className="mt-3">
                  <Label>デフォルト値</Label>
                  <Input
                    value={variable.default_value || ''}
                    onChange={(e) =>
                      handleUpdateVariable(index, 'default_value', e.target.value)
                    }
                    placeholder="デフォルト値（任意）"
                  />
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={handleAddVariable} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              変数を追加
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'preview' && (
        <div className="space-y-4">
          {/* Sample Data Input */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">サンプルデータ</CardTitle>
              <CardDescription>
                プレビュー用のサンプルデータを入力してください。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {variables.map((variable) => (
                  <div key={variable.key}>
                    <Label>{variable.label}</Label>
                    <Input
                      value={sampleData[variable.key] || ''}
                      onChange={(e) =>
                        setSampleData((prev) => ({ ...prev, [variable.key]: e.target.value }))
                      }
                      placeholder={variable.default_value || `${variable.label}を入力`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">プレビュー結果</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mx-auto max-w-[210mm] rounded-lg border bg-white p-8 shadow-sm">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {previewContent || '（テンプレート本文が空です）'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
