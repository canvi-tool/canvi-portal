'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { ArrowUp, ArrowDown, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { CustomFieldEditor } from '../_components/custom-field-editor'
import {
  ENTITY_TYPES,
  ENTITY_TYPE_LABELS,
  FIELD_TYPE_LABELS,
  type CreateCustomFieldInput,
} from '@/lib/validations/settings'
import type { Tables } from '@/lib/types/database'

type CustomFieldDef = Tables<'custom_field_definitions'>

export default function CustomFieldsSettingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [entityType, setEntityType] = useState<string>(ENTITY_TYPES[0])
  const [fields, setFields] = useState<CustomFieldDef[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchFields = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/settings/custom-fields?entity_type=${entityType}`
      )
      if (res.status === 403) {
        router.push('/dashboard')
        return
      }
      if (!res.ok) throw new Error('データの取得に失敗しました')
      const data = await res.json()
      setFields(data.fields)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [entityType, router])

  useEffect(() => {
    fetchFields()
  }, [fetchFields])

  async function handleSave(
    data: Partial<CreateCustomFieldInput> & { id?: string }
  ) {
    const isUpdate = !!data.id
    const res = await fetch('/api/settings/custom-fields', {
      method: isUpdate ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? '保存に失敗しました')
    }
    toast.success(isUpdate ? 'フィールドを更新しました' : 'フィールドを作成しました')
    await fetchFields()
  }

  async function handleDeactivate(fieldId: string) {
    const res = await fetch('/api/settings/custom-fields', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: fieldId, is_active: false }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? '無効化に失敗しました')
      return
    }
    toast.success('フィールドを無効化しました')
    await fetchFields()
  }

  async function handleReorder(fieldId: string, direction: 'up' | 'down') {
    const activeFields = fields.filter((f) => f.is_active)
    const idx = activeFields.findIndex((f) => f.id === fieldId)
    if (
      idx < 0 ||
      (direction === 'up' && idx === 0) ||
      (direction === 'down' && idx === activeFields.length - 1)
    ) {
      return
    }
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const newOrder = [...activeFields]
    ;[newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]]
    const fieldIds = newOrder.map((f) => f.id)

    const res = await fetch('/api/settings/custom-fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: entityType, field_ids: fieldIds }),
    })
    if (!res.ok) {
      toast.error('並び替えに失敗しました')
      return
    }
    await fetchFields()
  }

  const activeFields = fields.filter((f) => f.is_active)
  const inactiveFields = fields.filter((f) => !f.is_active)

  return (
    <div className="space-y-6">
      <PageHeader
        title="カスタムフィールド"
        description="各エンティティに対してカスタムフィールドを定義・管理します。"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Label>エンティティタイプ</Label>
          <Select value={entityType} onValueChange={(v) => { if (v) setEntityType(v) }}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((et) => (
                <SelectItem key={et} value={et}>
                  {ENTITY_TYPE_LABELS[et]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CustomFieldEditor entityType={entityType} onSave={handleSave} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : activeFields.length === 0 && inactiveFields.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            カスタムフィールドがまだ定義されていません。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {activeFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">有効なフィールド</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {activeFields.map((field, idx) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={idx === 0}
                            onClick={() => handleReorder(field.id, 'up')}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={idx === activeFields.length - 1}
                            onClick={() => handleReorder(field.id, 'down')}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {field.field_label}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {FIELD_TYPE_LABELS[field.field_type] ?? field.field_type}
                            </Badge>
                            {field.is_required && (
                              <Badge variant="destructive" className="text-xs">
                                必須
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            キー: {field.field_name}
                            {field.field_type === 'select' &&
                              Array.isArray(field.options) &&
                              ` | 選択肢: ${(field.options as string[]).join(', ')}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <CustomFieldEditor
                          entityType={entityType}
                          field={field}
                          onSave={handleSave}
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeactivate(field.id)}
                          title="無効化"
                        >
                          <Ban className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {inactiveFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">
                  無効なフィールド
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {inactiveFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between rounded-lg border border-dashed p-3 opacity-60"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{field.field_label}</span>
                          <Badge variant="outline" className="text-xs">
                            {FIELD_TYPE_LABELS[field.field_type] ?? field.field_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          キー: {field.field_name}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const res = await fetch('/api/settings/custom-fields', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              id: field.id,
                              is_active: true,
                            }),
                          })
                          if (res.ok) {
                            toast.success('フィールドを再有効化しました')
                            await fetchFields()
                          }
                        }}
                      >
                        有効化
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
