'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, X, Pencil } from 'lucide-react'
import {
  ENTITY_TYPES,
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  type CreateCustomFieldInput,
} from '@/lib/validations/settings'
import type { Tables } from '@/lib/types/database'

type CustomFieldDef = Tables<'custom_field_definitions'>

interface CustomFieldEditorProps {
  entityType: string
  field?: CustomFieldDef | null
  onSave: (data: Partial<CreateCustomFieldInput> & { id?: string }) => Promise<void>
  trigger?: React.ReactNode
}

export function CustomFieldEditor({
  entityType,
  field,
  onSave,
  trigger,
}: CustomFieldEditorProps) {
  const isEditing = !!field
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fieldName, setFieldName] = useState(field?.field_name ?? '')
  const [fieldLabel, setFieldLabel] = useState(field?.field_label ?? '')
  const [fieldType, setFieldType] = useState<string>(field?.field_type ?? 'text')
  const [isRequired, setIsRequired] = useState(field?.is_required ?? false)
  const [options, setOptions] = useState<string[]>(
    Array.isArray(field?.options) ? (field.options as string[]) : []
  )
  const [newOption, setNewOption] = useState('')

  function resetForm() {
    if (!isEditing) {
      setFieldName('')
      setFieldLabel('')
      setFieldType('text')
      setIsRequired(false)
      setOptions([])
      setNewOption('')
    }
    setError(null)
  }

  function handleAddOption() {
    const trimmed = newOption.trim()
    if (trimmed && !options.includes(trimmed)) {
      setOptions([...options, trimmed])
      setNewOption('')
    }
  }

  function handleRemoveOption(idx: number) {
    setOptions(options.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const data: Partial<CreateCustomFieldInput> & { id?: string } = {
        entity_type: entityType as typeof ENTITY_TYPES[number],
        field_label: fieldLabel,
        field_type: fieldType as typeof FIELD_TYPES[number],
        is_required: isRequired,
        options: fieldType === 'select' ? options : null,
      }
      if (isEditing && field) {
        data.id = field.id
      } else {
        data.field_name = fieldName
      }
      await onSave(data)
      setOpen(false)
      resetForm()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger
        render={
          trigger ? (
            trigger as React.ReactElement
          ) : isEditing ? (
            <Button variant="ghost" size="icon-sm">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              フィールド追加
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'カスタムフィールド編集' : 'カスタムフィールド追加'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'フィールドの設定を変更します。'
                : '新しいカスタムフィールドを定義します。'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {!isEditing && (
              <div className="space-y-1.5">
                <Label htmlFor="cf-field-name">フィールドキー</Label>
                <Input
                  id="cf-field-name"
                  placeholder="例: emergency_contact"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  required
                  pattern="^[a-z][a-z0-9_]*$"
                  title="英小文字・数字・アンダースコアのみ（先頭は英小文字）"
                />
                <p className="text-xs text-muted-foreground">
                  英小文字・数字・アンダースコアのみ（先頭は英小文字）
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cf-field-label">ラベル</Label>
              <Input
                id="cf-field-label"
                placeholder="例: 緊急連絡先"
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>フィールドタイプ</Label>
              <Select
                value={fieldType}
                onValueChange={(val) => { if (val) setFieldType(val) }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((ft) => (
                    <SelectItem key={ft} value={ft}>
                      {FIELD_TYPE_LABELS[ft]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {fieldType === 'select' && (
              <div className="space-y-1.5">
                <Label>選択肢</Label>
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="flex-1 rounded border px-2 py-1 text-sm">
                        {opt}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemoveOption(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="新しい選択肢"
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddOption()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddOption}
                    >
                      追加
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                id="cf-required"
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="cf-required" className="font-normal">
                必須フィールド
              </Label>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={saving}>
              {saving ? '保存中...' : isEditing ? '更新' : '作成'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
