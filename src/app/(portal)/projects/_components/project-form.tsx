'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
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
  SelectValueWithLabel,
} from '@/components/ui/select'
import { projectFormSchema, type ProjectFormValues } from '@/lib/validations/project'
import { PROJECT_STATUS_LABELS, PROJECT_TYPE_OPTIONS } from '@/lib/constants'
import { SlackChannelCombobox } from './slack-channel-combobox'
import { Loader2, Hash, ShieldCheck } from 'lucide-react'

interface Client {
  id: string
  client_code: string
  name: string
}

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
  const [clients, setClients] = useState<Client[]>([])
  const [isLoadingNumber, setIsLoadingNumber] = useState(false)
  const isEditMode = !!defaultValues?.project_number

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      project_type: 'BPO',
      project_number: '',
      project_code: '',
      name: '',
      description: '',
      status: 'planning',
      client_id: '',
      client_name: '',
      start_date: '',
      end_date: '',
      google_calendar_id: '',
      slack_channel_id: '',
      slack_channel_name: '',
      shift_approval_mode: 'AUTO',
      ...defaultValues,
    },
  })

  const statusValue = watch('status')
  const projectType = watch('project_type')
  const projectNumber = watch('project_number')

  // Auto-generate project_code from type + number
  useEffect(() => {
    if (projectType && projectNumber) {
      setValue('project_code', `${projectType}-${projectNumber}`)
    }
  }, [projectType, projectNumber, setValue])

  // 新規作成時: プロジェクトタイプ変更で次の空き番号を自動取得
  useEffect(() => {
    if (isEditMode) return // 編集時は自動採番しない

    if (!projectType) return

    setIsLoadingNumber(true)
    fetch(`/api/projects/next-number?type=${projectType}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.next_number) {
          setValue('project_number', res.next_number)
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingNumber(false))
  }, [projectType, isEditMode, setValue])

  // Fetch clients
  useEffect(() => {
    fetch('/api/clients?limit=100')
      .then((r) => r.json())
      .then((res) => {
        if (res.data) setClients(res.data)
        else if (Array.isArray(res)) setClients(res)
      })
      .catch(() => {})
  }, [])


  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {/* PJコード（種別 + 番号） */}
      <div className="space-y-2">
        <Label>
          PJコード <span className="text-destructive">*</span>
        </Label>
        <div className="flex items-center gap-2">
          <Controller
            name="project_type"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(val) => field.onChange(val)}
              >
                <SelectTrigger className="w-28">
                  <SelectValueWithLabel value={field.value} labels={Object.fromEntries(PROJECT_TYPE_OPTIONS.map(o => [o.value, o.label]))} placeholder="種別" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <span className="text-muted-foreground">-</span>
          <Controller
            name="project_number"
            control={control}
            render={({ field }) => (
              <div className="relative">
                <Input
                  value={field.value}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 3)
                    field.onChange(v)
                  }}
                  onBlur={() => {
                    if (field.value) {
                      field.onChange(field.value.padStart(3, '0'))
                    }
                  }}
                  placeholder="001"
                  className="w-20"
                  maxLength={3}
                  disabled={isLoadingNumber}
                />
                {isLoadingNumber && (
                  <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
            )}
          />
          <span className="text-sm text-muted-foreground">
            → {projectType}-{projectNumber || '___'}
          </span>
        </div>
        {errors.project_type && (
          <p className="text-sm text-destructive">{errors.project_type.message}</p>
        )}
        {errors.project_number && (
          <p className="text-sm text-destructive">{errors.project_number.message}</p>
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
            <SelectValueWithLabel value={statusValue} labels={PROJECT_STATUS_LABELS} placeholder="ステータスを選択" />
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

      {/* クライアント */}
      <div className="space-y-2">
        <Label>クライアント</Label>
        <Controller
          name="client_id"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || undefined}
              onValueChange={(val) => {
                field.onChange(val === '__none__' ? '' : val)
                const client = clients.find((c) => c.id === val)
                if (client) {
                  setValue('client_name', client.name)
                } else {
                  setValue('client_name', '')
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValueWithLabel
                  value={field.value || null}
                  labels={Object.fromEntries(clients.map(c => [c.id, `${c.name}（${c.client_code}）`]))}
                  placeholder="クライアントを選択"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">（なし）</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}（{c.client_code}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">終了日</Label>
          <Input
            id="end_date"
            type="date"
            {...register('end_date')}
            aria-invalid={!!errors.end_date}
          />
        </div>
      </div>

      {/* シフト承認モード */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4" />
          シフト承認モード
        </Label>
        <p className="text-xs text-muted-foreground">
          AUTO: スタッフが登録すると即承認。APPROVAL: 管理者の承認が必要。
        </p>
        <Controller
          name="shift_approval_mode"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || 'AUTO'}
              onValueChange={(val) => field.onChange(val)}
            >
              <SelectTrigger className="w-full">
                <SelectValueWithLabel
                  value={field.value || 'AUTO'}
                  labels={{ AUTO: '自動承認（AUTO）', APPROVAL: '承認制（APPROVAL）' }}
                  placeholder="承認モードを選択"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">自動承認（AUTO）</SelectItem>
                <SelectItem value="APPROVAL">承認制（APPROVAL）</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Google Calendar ID */}
      <div className="space-y-2">
        <Label htmlFor="google_calendar_id">Google Calendar ID</Label>
        <Input
          id="google_calendar_id"
          placeholder="カレンダーIDを入力"
          {...register('google_calendar_id')}
        />
      </div>

      {/* Slack チャンネル連携 */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Hash className="h-4 w-4" />
          Slack通知チャンネル
        </Label>
        <p className="text-xs text-muted-foreground">
          このPJの出退勤通知・アラートを送信するSlackチャンネルを検索・選択
        </p>
        <Controller
          name="slack_channel_id"
          control={control}
          render={({ field }) => (
            <SlackChannelCombobox
              value={field.value || ''}
              onValueChange={(channelId, channelName) => {
                field.onChange(channelId)
                setValue('slack_channel_name', channelName ? `#${channelName}` : '')
              }}
            />
          )}
        />
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
