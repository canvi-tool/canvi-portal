'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

interface StaffInfo {
  id: string
  last_name: string
  first_name: string
  personal_email: string
  employment_type: string
}

type PageState = 'loading' | 'form' | 'submitting' | 'done' | 'error'

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: '正社員',
  part_time: 'パートタイム',
  contract: '契約社員',
  temporary: '派遣社員',
  freelance: 'フリーランス/業務委託',
}

/** 社員系かどうか（社員・パート・契約・派遣） */
function isEmployeeType(type: string): boolean {
  return ['full_time', 'part_time', 'contract', 'temporary'].includes(type)
}

export default function OnboardingPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<PageState>('loading')
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    last_name: '',
    first_name: '',
    last_name_kana: '',
    first_name_kana: '',
    date_of_birth: '',
    gender: '',
    phone: '',
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
    emergency_contact_name: '',
    emergency_contact_phone: '',
  })

  const isEmployee = staffInfo ? isEmployeeType(staffInfo.employment_type) : false

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(`/api/staff/onboarding/${token}`)
        if (!res.ok) {
          setState('error')
          setError('このリンクは無効または期限切れです。管理者にお問い合わせください。')
          return
        }
        const data: StaffInfo = await res.json()
        setStaffInfo(data)
        setForm((prev) => ({
          ...prev,
          last_name: data.last_name,
          first_name: data.first_name,
        }))
        setState('form')
      } catch {
        setState('error')
        setError('接続エラーが発生しました。')
      }
    }
    verify()
  }, [token])

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    // Clear validation error when user types
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // 全員共通必須
    if (!form.last_name) errors.last_name = '姓は必須です'
    if (!form.first_name) errors.first_name = '名は必須です'
    if (!form.last_name_kana) errors.last_name_kana = '姓（カナ）は必須です'
    if (!form.first_name_kana) errors.first_name_kana = '名（カナ）は必須です'
    if (!form.date_of_birth) errors.date_of_birth = '生年月日は必須です'
    if (!form.phone) errors.phone = '電話番号は必須です'
    if (!form.prefecture) errors.prefecture = '都道府県は必須です'
    if (!form.bank_name) errors.bank_name = '銀行名は必須です'
    if (!form.bank_branch) errors.bank_branch = '支店名は必須です'
    if (!form.bank_account_number) errors.bank_account_number = '口座番号は必須です'
    if (!form.bank_account_holder) errors.bank_account_holder = '口座名義は必須です'

    // 社員系のみ追加必須
    if (isEmployee) {
      if (!form.postal_code) errors.postal_code = '郵便番号は必須です'
      if (!form.address_line1) errors.address_line1 = '住所は必須です'
      if (!form.emergency_contact_name) errors.emergency_contact_name = '緊急連絡先の氏名は必須です'
      if (!form.emergency_contact_phone) errors.emergency_contact_phone = '緊急連絡先の電話番号は必須です'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector('[data-error="true"]')
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setState('submitting')
    setError('')

    try {
      const res = await fetch(`/api/staff/onboarding/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '送信に失敗しました')
        setState('form')
        return
      }
      setState('done')
    } catch {
      setError('送信に失敗しました')
      setState('form')
    }
  }

  // Loading
  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  // Error (invalid token)
  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">アクセスできません</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Done
  if (state === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">登録が完了しました</h2>
            <p className="text-sm text-muted-foreground">
              ご入力ありがとうございます。<br />
              管理者の承認後、Canviアカウント（@canvi.co.jp）が発行され、<br />
              ログイン情報がメールで届きます。
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const employmentLabel = staffInfo ? EMPLOYMENT_TYPE_LABELS[staffInfo.employment_type] || staffInfo.employment_type : ''

  // Form
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 text-2xl font-bold text-white shadow-lg">
            C
          </div>
          <h1 className="text-2xl font-bold">Canvi スタッフ登録</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            入職にあたり、以下の情報をご入力ください
          </p>
          {employmentLabel && (
            <div className="mt-3 inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950 px-4 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300">
              雇用区分：{employmentLabel}
            </div>
          )}
        </div>

        {/* 必須項目の説明 */}
        {!isEmployee && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-3">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              業務委託の方は、緊急連絡先のみ任意です。その他の項目はすべてご入力ください。
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基本情報</CardTitle>
              <CardDescription>氏名・生年月日など</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="姓" required error={validationErrors.last_name}>
                  <Input value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} />
                </Field>
                <Field label="名" required error={validationErrors.first_name}>
                  <Input value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} />
                </Field>
                <Field label="姓（カナ）" required error={validationErrors.last_name_kana}>
                  <Input value={form.last_name_kana} onChange={(e) => updateField('last_name_kana', e.target.value)} placeholder="セイ" />
                </Field>
                <Field label="名（カナ）" required error={validationErrors.first_name_kana}>
                  <Input value={form.first_name_kana} onChange={(e) => updateField('first_name_kana', e.target.value)} placeholder="メイ" />
                </Field>
                <Field label="生年月日" required error={validationErrors.date_of_birth}>
                  <Input type="date" value={form.date_of_birth} onChange={(e) => updateField('date_of_birth', e.target.value)} />
                </Field>
                <Field label="性別">
                  <Select value={form.gender} onValueChange={(v) => updateField('gender', v)}>
                    <SelectTrigger><SelectValueWithLabel value={form.gender} placeholder="選択" labels={{ male: '男性', female: '女性', other: 'その他' }} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">男性</SelectItem>
                      <SelectItem value="female">女性</SelectItem>
                      <SelectItem value="other">その他</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* 連絡先 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">連絡先</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="電話番号" required error={validationErrors.phone}>
                  <Input type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="090-1234-5678" />
                </Field>
                <Field label="メールアドレス">
                  <Input value={staffInfo?.personal_email || ''} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground mt-1">招待時に登録済み</p>
                </Field>
                <Field label="郵便番号" required={isEmployee} error={validationErrors.postal_code}>
                  <Input value={form.postal_code} onChange={(e) => updateField('postal_code', e.target.value)} placeholder="123-4567" />
                </Field>
                <Field label="都道府県" required error={validationErrors.prefecture}>
                  <Input value={form.prefecture} onChange={(e) => updateField('prefecture', e.target.value)} placeholder="東京都" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="住所" required={isEmployee} error={validationErrors.address_line1}>
                    <Input value={form.address_line1} onChange={(e) => updateField('address_line1', e.target.value)} placeholder="市区町村 番地" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="建物名・部屋番号">
                    <Input value={form.address_line2} onChange={(e) => updateField('address_line2', e.target.value)} />
                  </Field>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 緊急連絡先 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">緊急連絡先</CardTitle>
              {!isEmployee && <CardDescription>任意項目です</CardDescription>}
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="氏名" required={isEmployee} error={validationErrors.emergency_contact_name}>
                  <Input value={form.emergency_contact_name} onChange={(e) => updateField('emergency_contact_name', e.target.value)} placeholder="連絡先の方のお名前" />
                </Field>
                <Field label="電話番号" required={isEmployee} error={validationErrors.emergency_contact_phone}>
                  <Input type="tel" value={form.emergency_contact_phone} onChange={(e) => updateField('emergency_contact_phone', e.target.value)} placeholder="090-1234-5678" />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* 銀行口座 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">銀行口座（給与振込先）</CardTitle>
              <CardDescription>給与・報酬の振込先</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="銀行名" required error={validationErrors.bank_name}>
                  <Input value={form.bank_name} onChange={(e) => updateField('bank_name', e.target.value)} />
                </Field>
                <Field label="支店名" required error={validationErrors.bank_branch}>
                  <Input value={form.bank_branch} onChange={(e) => updateField('bank_branch', e.target.value)} />
                </Field>
                <Field label="口座種別">
                  <Select value={form.bank_account_type} onValueChange={(v) => updateField('bank_account_type', v)}>
                    <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="普通">普通</SelectItem>
                      <SelectItem value="当座">当座</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="口座番号" required error={validationErrors.bank_account_number}>
                  <Input value={form.bank_account_number} onChange={(e) => updateField('bank_account_number', e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="口座名義（カタカナ）" required error={validationErrors.bank_account_holder}>
                    <Input value={form.bank_account_holder} onChange={(e) => updateField('bank_account_holder', e.target.value)} />
                  </Field>
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <div className="flex justify-center">
            <Button type="submit" size="lg" className="w-full sm:w-auto px-12" disabled={state === 'submitting'}>
              {state === 'submitting' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              登録内容を送信
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            送信後、管理者の承認を経てCanviアカウントが発行されます
          </p>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5" data-error={error ? 'true' : undefined}>
      <Label className="text-sm">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
