'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { projectFormSchema, type ProjectFormValues } from '@/lib/validations/project'
import { PROJECT_STATUS_LABELS } from '@/lib/constants'
import { Loader2 } from 'lucide-react'

interface ProjectFormProps {
  defaultValues?: Partial<ProjectFormValues>
  onSubmit: (data: ProjectFormValues) => void
  onCancel: () => void
  isSubmitting?: boolean
  submitLabel?: string
}

export function ProjectForm({
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = '保存',
}: ProjectFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      project_code: '',
      name: '',
      description: '',
      status: 'planning',
      client_name: '',
      start_date: '',
      end_date: '',
      google_calendar_id: '',
      ...defaultValues,
    },
  })

  const statusValue = watch('status')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {/* PJコード */}
      <div className="space-y-2">
        <Label htmlFor="project_code">
          PJコード <span className="text-destructive">*</span>
        </Label>
        <Input
          id="project_code"
          placeholder="例: PJ-2026-001"
          {...register('project_code')}
          aria-invalid={!!errors.project_code}
        />
        {errors.project_code && (
          <p className="text-sm text-destructive">{errors.project_code.message}</p>
        )}
      </div>

      {/* PJ名 */}
      <div className="space-y-2">
        <Label htmlFor="name">
          PJ名 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          placeholder="プロジェクト名を入力"
          {...register('name')}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* 説明 */}
      <div className="space-y-2">
        <Label htmlFor="description">説明</Label>
        <Textarea
          id="description"
          placeholder="プロジェクトの説明を入力"
          rows={4}
          {...register('description')}
          aria-invalid={!!errors.description}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* ステータス */}
      <div className="space-y-2">
        <Label>
          ステータス <span className="text-destructive">*</span>
        </Label>
        <Select
          value={statusValue}
          onValueChange={(val) => val && setValue('status', val as ProjectFormValues['status'])}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="ステータスを選択" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.status && (
          <p className="text-sm text-destructive">{errors.status.message}</p>
        )}
      </div>

      {/* クライアント名 */}
      <div className="space-y-2">
        <Label htmlFor="client_name">クライアント名</Label>
        <Input
          id="client_name"
          placeholder="クライアント名を入力"
          {...register('client_name')}
          aria-invalid={!!errors.client_name}
        />
        {errors.client_name && (
          <p className="text-sm text-destructive">{errors.client_name.message}</p>
        )}
      </div>

      {/* 日付 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start_date">開始日</Label>
          <Input
            id="start_date"
            type="date"
            {...register('start_date')}
            aria-invalid={!!errors.start_date}
          />
          {errors.start_date && (
            <p className="text-sm text-destructive">{errors.start_date.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">終了日</Label>
          <Input
            id="end_date"
            type="date"
            {...register('end_date')}
            aria-invalid={!!errors.end_date}
          />
          {errors.end_date && (
            <p className="text-sm text-destructive">{errors.end_date.message}</p>
          )}
        </div>
      </div>

      {/* Google Calendar ID */}
      <div className="space-y-2">
        <Label htmlFor="google_calendar_id">Google Calendar ID</Label>
        <Input
          id="google_calendar_id"
          placeholder="カレンダーIDを入力"
          {...register('google_calendar_id')}
          aria-invalid={!!errors.google_calendar_id}
        />
        {errors.google_calendar_id && (
          <p className="text-sm text-destructive">{errors.google_calendar_id.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          キャンセル
        </Button>
      </div>
    </form>
  )
}
