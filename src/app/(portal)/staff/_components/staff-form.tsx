'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { staffFormSchema, type StaffFormValues } from '@/lib/validations/staff'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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

export interface ProvisioningData {
  create_google_account: boolean
  google_email_prefix: string
  google_org_unit: string
  create_zoom_account: boolean
  zoom_license_type: number
}

interface StaffFormProps {
  defaultValues?: Partial<StaffFormValues>
  onSubmit: (data: StaffFormValues, provisioning?: ProvisioningData) => void | Promise<void>
  isLoading?: boolean
  showProvisioning?: boolean
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

const ORG_UNITS = [
  { value: '/管理部', label: '管理部' },
  { value: '/営業部', label: '営業部' },
  { value: '/開発部', label: '開発部' },
  { value: '/スタッフ', label: 'スタッフ' },
]

const ZOOM_LICENSE_TYPES = [
  { value: 1, label: 'Basic（無料）' },
  { value: 2, label: 'Licensed（有料）' },
]

export function StaffForm({ defaultValues, onSubmit, isLoading, showProvisioning = true }: StaffFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
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
      last_name_eiji: '',
      first_name_eiji: '',
      email: '',
      personal_email: '',
      phone: '',
      gender: '',
      date_of_birth: '',
      postal_code: '',
      prefecture: '',
      city: '',
      address_line1: '',
      address_line2: '',
      bank_name: '',
      bank_branch: '',
      bank_account_type: '',
      bank_account_number: '',
      bank_account_holder: '',
      hire_date: '',
      notes: '',
      ...defaultValues,
    },
  })

  // Provisioning state (separate from zod schema)
  const [createGoogle, setCreateGoogle] = useState(false)
  const [googleEmailPrefix, setGoogleEmailPrefix] = useState('')
  const [googleOrgUnit, setGoogleOrgUnit] = useState('/スタッフ')
  const [createZoom, setCreateZoom] = useState(false)
  const [zoomLicenseType, setZoomLicenseType] = useState(1)
  const [googleEmailManuallyEdited, setGoogleEmailManuallyEdited] = useState(false)

  // Watch last_name_kana for auto-filling google email prefix
  const lastNameKana = watch('last_name_kana')

  // Auto-fill google email prefix from last_name_kana (convert katakana to romaji-like lowercase)
  useEffect(() => {
    if (createGoogle && !googleEmailManuallyEdited && lastNameKana) {
      // Simple katakana to romaji conversion for common names
      const romaji = kanaToRomaji(lastNameKana).toLowerCase()
      if (romaji) {
        setGoogleEmailPrefix(romaji)
      }
    }
  }, [lastNameKana, createGoogle, googleEmailManuallyEdited])

  const handleFormSubmit = (data: StaffFormValues) => {
    if (showProvisioning && (createGoogle || createZoom)) {
      const provisioningData: ProvisioningData = {
        create_google_account: createGoogle,
        google_email_prefix: googleEmailPrefix,
        google_org_unit: googleOrgUnit,
        create_zoom_account: createZoom,
        zoom_license_type: zoomLicenseType,
      }
      onSubmit(data, provisioningData)
    } else {
      onSubmit(data)
    }
  }

  const googleEmail = googleEmailPrefix ? `${googleEmailPrefix}@canvi.co.jp` : ''

  // Determine which email Zoom will use
  const zoomEmail = createGoogle && googleEmail ? googleEmail : watch('email') || ''

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
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
              <Controller
                name="staff_code"
                control={control}
                render={({ field }) => {
                  const prefix = 'S'
                  const num = field.value?.replace(/^S/, '') || ''
                  return (
                    <div className="flex items-center gap-0">
                      <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 h-9 text-sm text-muted-foreground">
                        {prefix}
                      </span>
                      <Input
                        value={num}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                          field.onChange(v ? `S${v.padStart(4, '0')}` : '')
                        }}
                        onBlur={() => {
                          if (num && num.replace(/\D/g, '')) {
                            field.onChange(`S${num.replace(/\D/g, '').padStart(4, '0')}`)
                          }
                        }}
                        placeholder="0001"
                        className="rounded-l-none w-24"
                        maxLength={4}
                      />
                    </div>
                  )
                }}
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
                      <SelectItem value="full_time">正社員</SelectItem>
                      <SelectItem value="part_time">パートタイム</SelectItem>
                      <SelectItem value="contract">契約社員</SelectItem>
                      <SelectItem value="temporary">派遣社員</SelectItem>
                      <SelectItem value="freelance">フリーランス/業務委託</SelectItem>
                      <SelectItem value="executive">役員</SelectItem>
                      <SelectItem value="other">その他</SelectItem>
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

            <FormField label="入職日" error={errors.hire_date?.message}>
              <Input type="date" {...register('hire_date')} />
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

            <FormField label="個人メール" error={errors.personal_email?.message}>
              <Input
                type="email"
                {...register('personal_email')}
                placeholder="契約書・支払通知書送付用"
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField label="住所" error={errors.address_line1?.message}>
                <Input {...register('address_line1')} placeholder="住所" />
              </FormField>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 外部アカウント作成 */}
      {showProvisioning && (
        <Card>
          <CardHeader>
            <CardTitle>外部アカウント作成</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Google Workspace */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="create-google" className="text-sm font-medium">
                  Google Workspaceアカウントを作成
                </Label>
                <Switch
                  id="create-google"
                  checked={createGoogle}
                  onCheckedChange={setCreateGoogle}
                />
              </div>

              {createGoogle && (
                <div className="grid gap-4 sm:grid-cols-2 pl-1 border-l-2 border-muted ml-1">
                  <FormField label="メールアドレス" required>
                    <div className="flex items-center gap-0">
                      <Input
                        value={googleEmailPrefix}
                        onChange={(e) => {
                          setGoogleEmailPrefix(e.target.value)
                          setGoogleEmailManuallyEdited(true)
                        }}
                        placeholder="username"
                        className="rounded-r-none"
                      />
                      <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 h-9 text-sm text-muted-foreground whitespace-nowrap">
                        @canvi.co.jp
                      </span>
                    </div>
                  </FormField>

                  <FormField label="組織部門" required>
                    <Select
                      value={googleOrgUnit}
                      onValueChange={setGoogleOrgUnit}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {ORG_UNITS.map((ou) => (
                          <SelectItem key={ou.value} value={ou.value}>
                            {ou.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
              )}
            </div>

            {/* Zoom */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="create-zoom" className="text-sm font-medium">
                  Zoomアカウントを作成
                </Label>
                <Switch
                  id="create-zoom"
                  checked={createZoom}
                  onCheckedChange={setCreateZoom}
                />
              </div>

              {createZoom && (
                <div className="grid gap-4 sm:grid-cols-2 pl-1 border-l-2 border-muted ml-1">
                  <FormField label="ライセンス種別" required>
                    <Select
                      value={String(zoomLicenseType)}
                      onValueChange={(val) => setZoomLicenseType(Number(val))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {ZOOM_LICENSE_TYPES.map((lt) => (
                          <SelectItem key={lt.value} value={String(lt.value)}>
                            {lt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField label="使用メールアドレス">
                    <Input
                      value={zoomEmail}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {createGoogle
                        ? 'Google Workspaceのメールアドレスを使用します'
                        : 'スタッフのメールアドレスを使用します'}
                    </p>
                  </FormField>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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

/**
 * Simple katakana to romaji conversion for common Japanese surnames.
 * This is a basic mapping - not exhaustive but covers common patterns.
 */
function kanaToRomaji(kana: string): string {
  const map: Record<string, string> = {
    'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
    'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
    'サ': 'sa', 'シ': 'shi', 'ス': 'su', 'セ': 'se', 'ソ': 'so',
    'タ': 'ta', 'チ': 'chi', 'ツ': 'tsu', 'テ': 'te', 'ト': 'to',
    'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no',
    'ハ': 'ha', 'ヒ': 'hi', 'フ': 'fu', 'ヘ': 'he', 'ホ': 'ho',
    'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo',
    'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
    'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro',
    'ワ': 'wa', 'ヲ': 'wo', 'ン': 'n',
    'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go',
    'ザ': 'za', 'ジ': 'ji', 'ズ': 'zu', 'ゼ': 'ze', 'ゾ': 'zo',
    'ダ': 'da', 'ヂ': 'di', 'ヅ': 'du', 'デ': 'de', 'ド': 'do',
    'バ': 'ba', 'ビ': 'bi', 'ブ': 'bu', 'ベ': 'be', 'ボ': 'bo',
    'パ': 'pa', 'ピ': 'pi', 'プ': 'pu', 'ペ': 'pe', 'ポ': 'po',
    'キャ': 'kya', 'キュ': 'kyu', 'キョ': 'kyo',
    'シャ': 'sha', 'シュ': 'shu', 'ショ': 'sho',
    'チャ': 'cha', 'チュ': 'chu', 'チョ': 'cho',
    'ニャ': 'nya', 'ニュ': 'nyu', 'ニョ': 'nyo',
    'ヒャ': 'hya', 'ヒュ': 'hyu', 'ヒョ': 'hyo',
    'ミャ': 'mya', 'ミュ': 'myu', 'ミョ': 'myo',
    'リャ': 'rya', 'リュ': 'ryu', 'リョ': 'ryo',
    'ギャ': 'gya', 'ギュ': 'gyu', 'ギョ': 'gyo',
    'ジャ': 'ja', 'ジュ': 'ju', 'ジョ': 'jo',
    'ビャ': 'bya', 'ビュ': 'byu', 'ビョ': 'byo',
    'ピャ': 'pya', 'ピュ': 'pyu', 'ピョ': 'pyo',
    'ッ': '',  // handled as double consonant
    'ー': '',  // long vowel mark (ignored)
  }

  let result = ''
  let i = 0
  while (i < kana.length) {
    // Try two-character combinations first (for combo kana like キャ)
    if (i + 1 < kana.length) {
      const twoChar = kana[i] + kana[i + 1]
      if (map[twoChar] !== undefined) {
        result += map[twoChar]
        i += 2
        continue
      }
    }

    // Handle small tsu (ッ) - doubles the next consonant
    if (kana[i] === 'ッ' && i + 1 < kana.length) {
      const nextChar = kana[i + 1]
      const nextRomaji = map[nextChar]
      if (nextRomaji && nextRomaji.length > 0) {
        result += nextRomaji[0]  // double the first consonant
      }
      i++
      continue
    }

    const oneChar = kana[i]
    if (map[oneChar] !== undefined) {
      result += map[oneChar]
    }
    i++
  }

  return result
}
