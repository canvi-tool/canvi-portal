'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clientFormSchema, type ClientFormValues } from '@/lib/validations/client'
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
import { CLIENT_STATUS_LABELS } from '@/lib/constants'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface ClientFormProps {
  defaultValues?: Partial<ClientFormValues>
  onSubmit: (data: ClientFormValues) => void | Promise<void>
  isLoading?: boolean
  codeReadOnly?: boolean
}

function FormField({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function ClientForm({ defaultValues, onSubmit, isLoading, codeReadOnly }: ClientFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      client_code: '',
      name: '',
      name_kana: '',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      address: '',
      industry: '',
      notes: '',
      status: 'active',
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 基本情報 */}
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="クライアントコード"
              error={errors.client_code?.message}
              required
            >
              <Input
                {...register('client_code')}
                placeholder="例: CLT-001"
                readOnly={codeReadOnly}
                className={codeReadOnly ? 'bg-muted' : ''}
              />
            </FormField>

            <FormField
              label="ステータス"
              error={errors.status?.message}
            >
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? null}
                    onValueChange={(val) => field.onChange(val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValueWithLabel value={field.value} labels={CLIENT_STATUS_LABELS} placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">有効</SelectItem>
                      <SelectItem value="inactive">無効</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField
              label="クライアント名"
              error={errors.name?.message}
              required
            >
              <Input {...register('name')} placeholder="クライアント名" />
            </FormField>

            <FormField
              label="クライアント名（カナ）"
              error={errors.name_kana?.message}
            >
              <Input {...register('name_kana')} placeholder="クライアントメイ" />
            </FormField>

            <FormField
              label="業種"
              error={errors.industry?.message}
            >
              <Input {...register('industry')} placeholder="例: IT、製造業、サービス業" />
            </FormField>

            <div className="sm:col-span-2">
              <FormField label="住所" error={errors.address?.message}>
                <Input {...register('address')} placeholder="住所" />
              </FormField>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 担当者情報 */}
      <Card>
        <CardHeader>
          <CardTitle>担当者情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="担当者名"
              error={errors.contact_person?.message}
            >
              <Input {...register('contact_person')} placeholder="担当者名" />
            </FormField>

            <FormField
              label="メールアドレス"
              error={errors.contact_email?.message}
            >
              <Input
                type="email"
                {...register('contact_email')}
                placeholder="example@email.com"
              />
            </FormField>

            <FormField
              label="電話番号"
              error={errors.contact_phone?.message}
            >
              <Input
                type="tel"
                {...register('contact_phone')}
                placeholder="03-1234-5678"
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* その他 */}
      <Card>
        <CardHeader>
          <CardTitle>その他</CardTitle>
        </CardHeader>
        <CardContent>
          <FormField label="備考" error={errors.notes?.message}>
            <Textarea
              {...register('notes')}
              placeholder="メモや備考を入力してください"
              rows={4}
            />
          </FormField>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {defaultValues ? '更新する' : '登録する'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
        >
          キャンセル
        </Button>
      </div>
    </form>
  )
}
