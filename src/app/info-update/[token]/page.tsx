'use client'

import { useState, useEffect, useRef } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, CheckCircle2, XCircle, AlertCircle, Upload, X, ChevronDown, ChevronUp, Shield } from 'lucide-react'
import {
  formatBankAccountNumber,
  normalizeBankAccountHolder,
  toKatakana,
  formatPostalCode,
  formatPhoneNumber,
  fetchAddressFromPostalCode,
} from '@/lib/form-helpers'
import { EMERGENCY_RELATIONSHIP_OPTIONS, ID_DOCUMENT_TYPES, requiresEmergencyContact, isFreelanceType } from '@/lib/validations/staff'
import { compressImage } from '@/lib/image-compress'

const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
  '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
  '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
  '熊本県','大分県','宮崎県','鹿児島県','沖縄県',
]

interface StaffData {
  id: string
  last_name: string
  first_name: string
  last_name_kana: string
  first_name_kana: string
  last_name_eiji: string
  first_name_eiji: string
  date_of_birth: string
  gender: string
  phone: string
  postal_code: string
  prefecture: string
  city: string
  address_line1: string
  address_line2: string
  bank_name: string
  bank_branch: string
  bank_account_type: string
  bank_account_number: string
  bank_account_holder: string
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
  personal_email: string
  email: string
  employment_type: string
}

type PageState = 'loading' | 'form' | 'submitting' | 'done' | 'error' | 'already_completed'

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: '正社員',
  part_time: 'パートタイム',
  contract: '契約社員',
  temporary: '派遣社員',
  freelance: 'フリーランス/業務委託',
}

export default function InfoUpdatePage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<PageState>('loading')
  const [staffData, setStaffData] = useState<StaffData | null>(null)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    last_name: '',
    first_name: '',
    last_name_kana: '',
    first_name_kana: '',
    last_name_eiji: '',
    first_name_eiji: '',
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
    emergency_contact_relationship: '',
    emergency_contact_relationship_other: '',
  })

  // プライバシーポリシー同意
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [privacyExpanded, setPrivacyExpanded] = useState(false)

  // 本人確認書類
  const [idDocType, setIdDocType] = useState('')
  const [idDocFront, setIdDocFront] = useState<File | null>(null)
  const [idDocBack, setIdDocBack] = useState<File | null>(null)
  const [idDocFrontPreview, setIdDocFrontPreview] = useState<string | null>(null)
  const [idDocBackPreview, setIdDocBackPreview] = useState<string | null>(null)
  const frontInputRef = useRef<HTMLInputElement>(null)
  const backInputRef = useRef<HTMLInputElement>(null)

  const isFreelance = staffData ? isFreelanceType(staffData.employment_type) : true
  const emergencyRequired = staffData ? requiresEmergencyContact(staffData.employment_type) : false
  const idDocRequired = !isFreelance

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(`/api/staff/info-update/${token}`)
        if (res.status === 410) {
          setState('already_completed')
          return
        }
        if (!res.ok) {
          setState('error')
          setError('このリンクは無効または期限切れです。管理者にお問い合わせください。')
          return
        }
        const data: StaffData = await res.json()
        setStaffData(data)

        // 既存データでフォームをプリフィル
        const relationship = data.emergency_contact_relationship || ''
        const isStandardRelationship = EMERGENCY_RELATIONSHIP_OPTIONS.some((o) => o.value === relationship)

        setForm({
          last_name: data.last_name || '',
          first_name: data.first_name || '',
          last_name_kana: data.last_name_kana || '',
          first_name_kana: data.first_name_kana || '',
          last_name_eiji: data.last_name_eiji || '',
          first_name_eiji: data.first_name_eiji || '',
          date_of_birth: data.date_of_birth || '',
          gender: data.gender || '',
          phone: data.phone || '',
          postal_code: data.postal_code || '',
          prefecture: data.prefecture || '',
          city: data.city || '',
          address_line1: data.address_line1 || '',
          address_line2: data.address_line2 || '',
          bank_name: data.bank_name || '',
          bank_branch: data.bank_branch || '',
          bank_account_type: data.bank_account_type || '',
          bank_account_number: data.bank_account_number || '',
          bank_account_holder: data.bank_account_holder || '',
          emergency_contact_name: data.emergency_contact_name || '',
          emergency_contact_phone: data.emergency_contact_phone || '',
          emergency_contact_relationship: isStandardRelationship ? relationship : (relationship ? 'その他' : ''),
          emergency_contact_relationship_other: isStandardRelationship ? '' : relationship,
        })

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
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleFileSelect = async (type: 'front' | 'back', rawFile: File | null) => {
    const file = rawFile ? await compressImage(rawFile) : null
    if (type === 'front') {
      setIdDocFront(file)
      if (file) {
        const url = URL.createObjectURL(file)
        setIdDocFrontPreview(url)
      } else {
        setIdDocFrontPreview(null)
      }
      if (validationErrors.id_doc_front) {
        setValidationErrors((prev) => { const next = { ...prev }; delete next.id_doc_front; return next })
      }
    } else {
      setIdDocBack(file)
      if (file) {
        const url = URL.createObjectURL(file)
        setIdDocBackPreview(url)
      } else {
        setIdDocBackPreview(null)
      }
      if (validationErrors.id_doc_back) {
        setValidationErrors((prev) => { const next = { ...prev }; delete next.id_doc_back; return next })
      }
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!form.last_name) errors.last_name = '姓は必須です'
    if (!form.first_name) errors.first_name = '名は必須です'
    if (!form.last_name_kana) {
      errors.last_name_kana = '姓（カナ）は必須です'
    } else if (!/^[\u30A0-\u30FFー]+$/.test(form.last_name_kana)) {
      errors.last_name_kana = 'カタカナで入力してください'
    }
    if (!form.first_name_kana) {
      errors.first_name_kana = '名（カナ）は必須です'
    } else if (!/^[\u30A0-\u30FFー]+$/.test(form.first_name_kana)) {
      errors.first_name_kana = 'カタカナで入力してください'
    }
    if (!form.last_name_eiji) {
      errors.last_name_eiji = '姓（ローマ字）は必須です'
    } else if (!/^[a-z]+$/i.test(form.last_name_eiji)) {
      errors.last_name_eiji = 'アルファベット小文字で入力してください'
    }
    if (!form.first_name_eiji) {
      errors.first_name_eiji = '名（ローマ字）は必須です'
    } else if (!/^[a-z]+$/i.test(form.first_name_eiji)) {
      errors.first_name_eiji = 'アルファベット小文字で入力してください'
    }
    if (!form.date_of_birth) errors.date_of_birth = '生年月日は必須です'
    if (!form.phone) errors.phone = '電話番号は必須です'
    if (!form.gender) errors.gender = '性別は必須です'
    if (!form.postal_code) errors.postal_code = '郵便番号は必須です'
    if (!form.prefecture) errors.prefecture = '都道府県は必須です'
    if (!form.address_line1) errors.address_line1 = '住所は必須です'
    if (!form.bank_name) errors.bank_name = '銀行名は必須です'
    if (!form.bank_branch) errors.bank_branch = '支店名は必須です'
    if (!form.bank_account_number) errors.bank_account_number = '口座番号は必須です'
    if (!form.bank_account_holder) {
      errors.bank_account_holder = '口座名義は必須です'
    } else if (!/^[\u30A0-\u30FFー（）\u3000 ]+$/.test(form.bank_account_holder)) {
      errors.bank_account_holder = '口座名義はカタカナと（）で入力してください'
    }

    // 業務委託以外は緊急連絡先必須
    if (emergencyRequired) {
      if (!form.emergency_contact_name) errors.emergency_contact_name = '緊急連絡先の氏名は必須です'
      if (!form.emergency_contact_phone) errors.emergency_contact_phone = '緊急連絡先の電話番号は必須です'
    }
    // 業務委託以外は本人確認書類必須
    if (idDocRequired) {
      if (!idDocType) errors.id_doc_type = '本人確認書類の種類を選択してください'
      if (!idDocFront) errors.id_doc_front = '書類の画像をアップロードしてください'
      if (!idDocBack) errors.id_doc_back = '書類の画像をアップロードしてください'
    }

    if (form.emergency_contact_relationship === 'その他' && !form.emergency_contact_relationship_other) {
      errors.emergency_contact_relationship_other = '続柄を入力してください'
    }

    if (!privacyAgreed) {
      errors.privacy = '個人情報の取り扱いに同意してください'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      const firstError = document.querySelector('[data-error="true"]')
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setState('submitting')
    setError('')

    try {
      const submitData = {
        ...form,
        last_name_eiji: form.last_name_eiji.toLowerCase(),
        first_name_eiji: form.first_name_eiji.toLowerCase(),
        emergency_contact_relationship:
          form.emergency_contact_relationship === 'その他'
            ? form.emergency_contact_relationship_other
            : form.emergency_contact_relationship,
      }

      let res: Response
      if (idDocRequired && idDocFront && idDocBack) {
        const formData = new FormData()
        formData.append('json', JSON.stringify(submitData))
        formData.append('id_doc_type', idDocType)
        formData.append('id_doc_front', idDocFront)
        formData.append('id_doc_back', idDocBack)

        res = await fetch(`/api/staff/info-update/${token}`, {
          method: 'POST',
          body: formData,
        })
      } else {
        res = await fetch(`/api/staff/info-update/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData),
        })
      }

      if (!res.ok) {
        let errorMsg = '送信に失敗しました'
        try {
          const data = await res.json()
          errorMsg = data.error || errorMsg
        } catch {
          if (res.status === 413) {
            errorMsg = 'ファイルサイズが大きすぎます。画像を小さくして再度お試しください。'
          } else {
            errorMsg = `送信に失敗しました（エラーコード: ${res.status}）`
          }
        }
        setError(errorMsg)
        setState('form')
        return
      }

      setState('done')
    } catch (err) {
      console.error('Submit error:', err)
      setError(err instanceof Error ? `送信に失敗しました: ${err.message}` : '送信に失敗しました')
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

  // Error
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

  // Already completed
  if (state === 'already_completed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">更新済みです</h2>
            <p className="text-sm text-muted-foreground">
              この情報更新フォームは既に送信済みです。<br />
              再度更新が必要な場合は管理者にお問い合わせください。
            </p>
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
            <h2 className="text-lg font-semibold mb-2">情報の更新が完了しました</h2>
            <p className="text-sm text-muted-foreground">
              ご入力ありがとうございます。<br />
              更新内容は管理者に反映されました。
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const employmentLabel = staffData ? EMPLOYMENT_TYPE_LABELS[staffData.employment_type] || staffData.employment_type : ''
  const selectedDocType = ID_DOCUMENT_TYPES.find((d) => d.value === idDocType)

  // Form
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 text-2xl font-bold text-white shadow-lg">
            C
          </div>
          <h1 className="text-2xl font-bold">Canvi スタッフ情報更新</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            不足している情報をご入力ください。既に登録済みの項目は反映されています。
          </p>
          {employmentLabel && (
            <div className="mt-3 inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950 px-4 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300">
              雇用区分：{employmentLabel}
            </div>
          )}
        </div>

        {/* 不足項目の案内 */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            入力済みの項目も修正可能です。全項目をご確認のうえ、不足分を入力して送信してください。
          </p>
        </div>

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
                  <Input
                    value={form.last_name_kana}
                    onChange={(e) => updateField('last_name_kana', e.target.value)}
                    onBlur={() => updateField('last_name_kana', toKatakana(form.last_name_kana))}
                    placeholder="セイ（ひらがなは自動変換されます）"
                  />
                </Field>
                <Field label="名（カナ）" required error={validationErrors.first_name_kana}>
                  <Input
                    value={form.first_name_kana}
                    onChange={(e) => updateField('first_name_kana', e.target.value)}
                    onBlur={() => updateField('first_name_kana', toKatakana(form.first_name_kana))}
                    placeholder="メイ（ひらがなは自動変換されます）"
                  />
                </Field>
                <Field label="姓（ローマ字）" required error={validationErrors.last_name_eiji}>
                  <Input
                    value={form.last_name_eiji}
                    onChange={(e) => updateField('last_name_eiji', e.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase())}
                    placeholder="yamada"
                  />
                </Field>
                <Field label="名（ローマ字）" required error={validationErrors.first_name_eiji}>
                  <Input
                    value={form.first_name_eiji}
                    onChange={(e) => updateField('first_name_eiji', e.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase())}
                    placeholder="taro"
                  />
                </Field>
                <Field label="生年月日" required error={validationErrors.date_of_birth}>
                  <Input type="date" value={form.date_of_birth} onChange={(e) => updateField('date_of_birth', e.target.value)} />
                </Field>
                <Field label="性別" required error={validationErrors.gender}>
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
                  <Input type="tel" value={form.phone} onChange={(e) => updateField('phone', formatPhoneNumber(e.target.value))} placeholder="090-1234-5678" />
                </Field>
                <Field label="メールアドレス">
                  <Input value={staffData?.email || staffData?.personal_email || ''} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground mt-1">登録済み（変更不可）</p>
                </Field>
                <Field label="郵便番号" required error={validationErrors.postal_code}>
                  <Input
                    value={form.postal_code}
                    onChange={(e) => {
                      const formatted = formatPostalCode(e.target.value)
                      updateField('postal_code', formatted)
                      if (formatted.replace(/-/g, '').length === 7) {
                        fetchAddressFromPostalCode(formatted).then((addr) => {
                          if (addr) {
                            updateField('prefecture', addr.prefecture)
                            updateField('city', addr.city)
                            updateField('address_line1', addr.address)
                          }
                        })
                      }
                    }}
                    placeholder="000-0000"
                    maxLength={8}
                  />
                </Field>
                <Field label="都道府県" required error={validationErrors.prefecture}>
                  <Select value={form.prefecture} onValueChange={(v) => updateField('prefecture', v)}>
                    <SelectTrigger>
                      <SelectValueWithLabel
                        value={form.prefecture}
                        placeholder="選択"
                        labels={Object.fromEntries(PREFECTURES.map((p) => [p, p]))}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {PREFECTURES.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="住所" required error={validationErrors.address_line1}>
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
              {!emergencyRequired && <CardDescription>任意項目です</CardDescription>}
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="氏名" required={emergencyRequired} error={validationErrors.emergency_contact_name}>
                  <Input value={form.emergency_contact_name} onChange={(e) => updateField('emergency_contact_name', e.target.value)} placeholder="連絡先の方のお名前" />
                </Field>
                <Field label="電話番号" required={emergencyRequired} error={validationErrors.emergency_contact_phone}>
                  <Input type="tel" value={form.emergency_contact_phone} onChange={(e) => updateField('emergency_contact_phone', formatPhoneNumber(e.target.value))} placeholder="090-1234-5678" />
                </Field>
                <Field label="本人との関係" required={emergencyRequired} error={validationErrors.emergency_contact_relationship}>
                  <Select value={form.emergency_contact_relationship} onValueChange={(v) => {
                    updateField('emergency_contact_relationship', v)
                    if (v !== 'その他') updateField('emergency_contact_relationship_other', '')
                  }}>
                    <SelectTrigger>
                      <SelectValueWithLabel
                        value={form.emergency_contact_relationship}
                        placeholder="選択"
                        labels={Object.fromEntries(EMERGENCY_RELATIONSHIP_OPTIONS.map((o) => [o.value, o.label]))}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {EMERGENCY_RELATIONSHIP_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {form.emergency_contact_relationship === 'その他' && (
                  <Field label="関係（詳細）" required error={validationErrors.emergency_contact_relationship_other}>
                    <Input
                      value={form.emergency_contact_relationship_other}
                      onChange={(e) => updateField('emergency_contact_relationship_other', e.target.value)}
                      placeholder="例：同居人、知人など"
                    />
                  </Field>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 本人確認書類（社員系のみ） */}
          {idDocRequired && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">本人確認書類</CardTitle>
                <CardDescription>雇用手続きに必要な書類の画像をアップロードしてください</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="書類の種類" required error={validationErrors.id_doc_type}>
                  <Select value={idDocType} onValueChange={(v) => {
                    setIdDocType(v)
                    setIdDocFront(null)
                    setIdDocBack(null)
                    setIdDocFrontPreview(null)
                    setIdDocBackPreview(null)
                    if (validationErrors.id_doc_type) {
                      setValidationErrors((prev) => { const next = { ...prev }; delete next.id_doc_type; return next })
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValueWithLabel
                        value={idDocType}
                        placeholder="選択してください"
                        labels={Object.fromEntries(ID_DOCUMENT_TYPES.map((d) => [d.value, d.label]))}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {ID_DOCUMENT_TYPES.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {idDocType && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={selectedDocType?.frontLabel || '表面'} required error={validationErrors.id_doc_front}>
                      <FileUploadArea
                        file={idDocFront}
                        preview={idDocFrontPreview}
                        inputRef={frontInputRef}
                        onSelect={(f) => handleFileSelect('front', f)}
                        onClear={() => handleFileSelect('front', null)}
                      />
                    </Field>
                    <Field label={selectedDocType?.backLabel || '裏面'} required error={validationErrors.id_doc_back}>
                      <FileUploadArea
                        file={idDocBack}
                        preview={idDocBackPreview}
                        inputRef={backInputRef}
                        onSelect={(f) => handleFileSelect('back', f)}
                        onClear={() => handleFileSelect('back', null)}
                      />
                    </Field>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                  <Input
                    value={form.bank_account_number}
                    onChange={(e) => updateField('bank_account_number', formatBankAccountNumber(e.target.value))}
                    placeholder="半角数字7桁"
                    maxLength={7}
                    inputMode="numeric"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="口座名義（カタカナ）" required error={validationErrors.bank_account_holder}>
                    <Input
                      value={form.bank_account_holder}
                      onChange={(e) => updateField('bank_account_holder', e.target.value)}
                      onBlur={() => updateField('bank_account_holder', normalizeBankAccountHolder(form.bank_account_holder))}
                      placeholder="カタカナで入力（ひらがなは自動変換されます）"
                    />
                  </Field>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 個人情報の取り扱い */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-indigo-600" />
                個人情報の取り扱いについて
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30">
                <div
                  className={`px-4 py-3 text-xs leading-relaxed text-muted-foreground overflow-hidden transition-all ${privacyExpanded ? 'max-h-[2000px]' : 'max-h-40'}`}
                >
                  <p className="font-medium text-foreground mb-2">
                    株式会社Canvi 従業員等の個人情報保護方針
                  </p>
                  <p className="mb-3">
                    株式会社Canvi（以下「当社」といいます。）は、スタッフ情報更新フォームを通じてお預かりする個人情報の重要性を認識し、その適切な取り扱いに努めます。当社は、以下の方針に基づき、個人情報の保護を徹底いたします。
                  </p>
                  <p className="font-medium text-foreground mb-1">1. 個人情報の収集目的</p>
                  <p className="mb-1">当社は、本フォームを通じて以下の目的で個人情報を収集します。</p>
                  <ul className="list-disc pl-5 mb-3 space-y-0.5">
                    <li>雇用契約・業務委託契約の締結および履行</li>
                    <li>給与・報酬の計算および振込</li>
                    <li>社会保険・労働保険等の手続き</li>
                    <li>社内アカウント（Google Workspace等）の発行・管理</li>
                    <li>緊急時の連絡</li>
                    <li>法令に基づく届出・報告</li>
                  </ul>
                  <p className="font-medium text-foreground mb-1">2. 収集する個人情報の項目</p>
                  <ul className="list-disc pl-5 mb-3 space-y-0.5">
                    <li>氏名（漢字・カナ・ローマ字）</li>
                    <li>生年月日・性別</li>
                    <li>住所・電話番号</li>
                    <li>銀行口座情報（振込先）</li>
                    <li>緊急連絡先</li>
                    <li>本人確認書類の画像（該当者のみ）</li>
                  </ul>
                  <p className="font-medium text-foreground mb-1">3. 個人情報の利用範囲</p>
                  <p className="mb-3">収集した個人情報は、上記の目的の範囲内でのみ利用し、目的外の利用はいたしません。</p>
                  <p className="font-medium text-foreground mb-1">4. 個人情報の第三者提供</p>
                  <p className="mb-1">当社は、以下の場合を除き、収集した個人情報を第三者に提供することはありません。</p>
                  <ul className="list-disc pl-5 mb-3 space-y-0.5">
                    <li>ご本人の同意がある場合</li>
                    <li>法令に基づく場合</li>
                    <li>業務委託先に対して、必要な範囲で提供する場合（この場合、当社は委託先に対し適切な監督を行います）</li>
                  </ul>
                  <p className="font-medium text-foreground mb-1">5. 個人情報の管理</p>
                  <p className="mb-3">当社は、個人情報を厳重に管理し、不正アクセス、紛失、漏洩、改ざん等を防止するための適切な措置を講じます。</p>
                  <p className="font-medium text-foreground mb-1">6. 個人情報の開示・訂正・削除について</p>
                  <p className="mb-3">ご本人からの申し出があった場合、当社は、個人情報の開示、訂正、利用停止または削除のご要望に適切かつ迅速に対応いたします。</p>
                  <p className="font-medium text-foreground mb-1">7. 保管期間</p>
                  <p className="mb-3">収集した個人情報は、雇用・契約関係の存続期間中および法令に定められた保存期間中、適切に保管いたします。保管期間経過後は速やかに削除または破棄いたします。</p>
                  <p className="font-medium text-foreground mb-1">8. お問い合わせ窓口</p>
                  <p>【株式会社Canvi】<br />住所：東京都新宿区西新宿5丁目8-2 惠徳ビル<br />メールアドレス：info@canvi.co.jp</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrivacyExpanded(!privacyExpanded)}
                  className="w-full flex items-center justify-center gap-1 py-2 text-xs text-indigo-600 hover:text-indigo-800 border-t transition-colors"
                >
                  {privacyExpanded ? (
                    <>閉じる <ChevronUp className="h-3 w-3" /></>
                  ) : (
                    <>全文を表示 <ChevronDown className="h-3 w-3" /></>
                  )}
                </button>
              </div>

              <div className="flex items-start gap-3" data-error={validationErrors.privacy ? 'true' : undefined}>
                <Checkbox
                  checked={privacyAgreed}
                  onChange={(e) => {
                    setPrivacyAgreed(e.target.checked)
                    if (validationErrors.privacy) {
                      setValidationErrors((prev) => { const next = { ...prev }; delete next.privacy; return next })
                    }
                  }}
                  className="mt-0.5"
                />
                <label className="text-sm cursor-pointer select-none" onClick={() => {
                  setPrivacyAgreed(!privacyAgreed)
                  if (validationErrors.privacy) {
                    setValidationErrors((prev) => { const next = { ...prev }; delete next.privacy; return next })
                  }
                }}>
                  上記の個人情報の取り扱いについて同意します
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
              </div>
              {validationErrors.privacy && (
                <p className="text-xs text-red-500">{validationErrors.privacy}</p>
              )}
            </CardContent>
          </Card>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <div className="flex justify-center">
            <Button type="submit" size="lg" className="w-full sm:w-auto px-12" disabled={state === 'submitting' || !privacyAgreed}>
              {state === 'submitting' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              情報を更新する
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            送信後、情報は直接反映されます
          </p>
        </form>
      </div>
    </div>
  )
}

/** ファイルアップロードエリア */
function FileUploadArea({
  file,
  preview,
  inputRef,
  onSelect,
  onClear,
}: {
  file: File | null
  preview: string | null
  inputRef: React.RefObject<HTMLInputElement>
  onSelect: (file: File) => void
  onClear: () => void
}) {
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onSelect(f)
        }}
      />
      {file && preview ? (
        <div className="relative rounded-lg border border-input overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="プレビュー" className="w-full h-32 object-cover" />
          <button
            type="button"
            onClick={() => { onClear(); if (inputRef.current) inputRef.current.value = '' }}
            className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1 hover:bg-black/80"
          >
            <X className="h-3 w-3" />
          </button>
          <p className="text-xs text-muted-foreground p-2 truncate">{file.name}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-32 rounded-lg border-2 border-dashed border-input hover:border-indigo-400 flex flex-col items-center justify-center gap-2 transition-colors"
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">クリックしてアップロード</span>
        </button>
      )}
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
