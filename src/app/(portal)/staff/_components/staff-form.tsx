'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { staffFormSchema, type StaffFormValues } from '@/lib/validations/staff'
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface StaffFormProps {
  defaultValues?: Partial<StaffFormValues>
  onSubmit: (data: StaffFormValues) => void | Promise<void>
  isLoading?: boolean
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

export function StaffForm({ defaultValues, onSubmit, isLoading }: StaffFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      staff_code: '',
      employment_type: undefined,
      last_name: '',
      first_name: '',
      last_name_kana: '',
      first_name_kana: '',
      email: '',
      phone: '',
      date_of_birth: '',
      address: '',
      bank_name: '',
      bank_branch: '',
      bank_account_type: '',
      bank_account_number: '',
      bank_account_holder: '',
      join_date: '',
      notes: '',
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
              label="スタッフコード"
              error={errors.staff_code?.message}
              required
            >
              <Input
                {...register('staff_code')}
                placeholder="例: STF-001"
              />
            </FormField>

            <FormField
              label="雇用区分"
              error={errors.employment_type?.message}
              required
            >
              <Controller
                name="employment_type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? null}
                    onValueChange={(val) => field.onChange(val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">社員</SelectItem>
                      <SelectItem value="contractor">契約社員</SelectItem>
                      <SelectItem value="freelancer">フリーランス/業務委託</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="姓" error={errors.last_name?.message} required>
              <Input {...register('last_name')} placeholder="姓" />
            </FormField>

            <FormField label="名" error={errors.first_name?.message} required>
              <Input {...register('first_name')} placeholder="名" />
            </FormField>

            <FormField
              label="姓（カナ）"
              error={errors.last_name_kana?.message}
            >
              <Input {...register('last_name_kana')} placeholder="セイ" />
            </FormField>

            <FormField
              label="名（カナ）"
              error={errors.first_name_kana?.message}
            >
              <Input {...register('first_name_kana')} placeholder="メイ" />
            </FormField>

            <FormField
              label="生年月日"
              error={errors.date_of_birth?.message}
            >
              <Input type="date" {...register('date_of_birth')} />
            </FormField>

            <FormField label="入職日" error={errors.join_date?.message}>
              <Input type="date" {...register('join_date')} />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* 連絡先 */}
      <Card>
        <CardHeader>
          <CardTitle>連絡先</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="メールアドレス"
              error={errors.email?.message}
              required
            >
              <Input
                type="email"
                {...register('email')}
                placeholder="example@email.com"
              />
            </FormField>

            <FormField label="電話番号" error={errors.phone?.message}>
              <Input
                type="tel"
                {...register('phone')}
                placeholder="090-1234-5678"
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField label="住所" error={errors.address?.message}>
                <Input {...register('address')} placeholder="住所" />
              </FormField>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 銀行口座 */}
      <Card>
        <CardHeader>
          <CardTitle>銀行口座</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="銀行名" error={errors.bank_name?.message}>
              <Input {...register('bank_name')} placeholder="銀行名" />
            </FormField>

            <FormField label="支店名" error={errors.bank_branch?.message}>
              <Input {...register('bank_branch')} placeholder="支店名" />
            </FormField>

            <FormField
              label="口座種別"
              error={errors.bank_account_type?.message}
            >
              <Controller
                name="bank_account_type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || null}
                    onValueChange={(val) => field.onChange(val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="普通">普通</SelectItem>
                      <SelectItem value="当座">当座</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField
              label="口座番号"
              error={errors.bank_account_number?.message}
            >
              <Input
                {...register('bank_account_number')}
                placeholder="口座番号"
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField
                label="口座名義"
                error={errors.bank_account_holder?.message}
              >
                <Input
                  {...register('bank_account_holder')}
                  placeholder="口座名義（カタカナ）"
                />
              </FormField>
            </div>
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
