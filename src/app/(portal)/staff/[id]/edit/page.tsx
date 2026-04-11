'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { StaffForm } from '../../_components/staff-form'
import { ConfirmChangesDialog, type FieldChange } from '../../_components/confirm-changes-dialog'
import { useStaff, useUpdateStaff } from '@/hooks/use-staff'
import type { StaffFormValues } from '@/lib/validations/staff'
import {
  computeAttachmentRequirement,
  needsAnyAttachment,
} from '@/lib/profile/change-request-policy'

/** フィールドラベルマッピング */
const FIELD_LABELS: Record<string, string> = {
  staff_code: 'スタッフコード',
  employment_type: '雇用区分',
  last_name: '姓',
  first_name: '名',
  last_name_kana: '姓（カナ）',
  first_name_kana: '名（カナ）',
  last_name_eiji: '姓（英字）',
  first_name_eiji: '名（英字）',
  email: 'メールアドレス',
  personal_email: '個人メール',
  phone: '電話番号',
  gender: '性別',
  date_of_birth: '生年月日',
  postal_code: '郵便番号',
  prefecture: '都道府県',
  city: '市区町村',
  address_line1: '住所',
  address_line2: '建物名・部屋番号',
  bank_name: '銀行名',
  bank_branch: '支店名',
  bank_account_type: '口座種別',
  bank_account_number: '口座番号',
  bank_account_holder: '口座名義',
  hire_date: '入職日',
  notes: '備考',
  hourly_rate: '時給',
  daily_rate: '日給',
  monthly_salary: '月給',
  transportation_allowance: '交通費',
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: '正社員',
  part_time: 'パートタイム',
  contract: '契約社員',
  temporary: '派遣社員',
  freelance: 'フリーランス/業務委託',
  executive: '役員',
  other: 'その他',
}

const GENDER_LABELS: Record<string, string> = {
  male: '男性',
  female: '女性',
  other: 'その他',
  prefer_not_to_say: '回答しない',
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const str = String(value)
  if (key === 'employment_type') return EMPLOYMENT_TYPE_LABELS[str] || str
  if (key === 'gender') return GENDER_LABELS[str] || str
  if (typeof value === 'number') return value.toLocaleString()
  return str
}

interface EditStaffPageProps {
  params: { id: string }
}

export default function EditStaffPage({ params }: EditStaffPageProps) {
  const { id } = params
  const router = useRouter()
  const { data: staff, isLoading: isLoadingStaff } = useStaff(id)
  const { mutateAsync, isPending } = useUpdateStaff(id)

  const [showConfirm, setShowConfirm] = useState(false)
  const [changes, setChanges] = useState<FieldChange[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([])
  const [attachmentRequirement, setAttachmentRequirement] = useState({
    requiresIdentityDoc: false,
    requiresAddressDoc: false,
    requiresBankHolderDoc: false,
  })
  const pendingSubmitRef = useRef<{
    data: StaffFormValues
    changedKeys: string[]
  } | null>(null)

  useEffect(() => {
    fetch('/api/user/current')
      .then(r => r.json())
      .then(d => setIsOwner(Array.isArray(d.roles) && d.roles.includes('owner')))
      .catch(() => {})
  }, [])

  // Build original values from staff record
  function getOriginalValues(): Record<string, unknown> {
    if (!staff) return {}
    return {
      staff_code: staff.staff_code || '',
      employment_type: staff.employment_type || '',
      last_name: staff.last_name || '',
      first_name: staff.first_name || '',
      last_name_kana: staff.last_name_kana || '',
      first_name_kana: staff.first_name_kana || '',
      last_name_eiji: staff.last_name_eiji || '',
      first_name_eiji: staff.first_name_eiji || '',
      email: staff.email || '',
      personal_email: staff.personal_email || '',
      phone: staff.phone || '',
      gender: staff.gender || '',
      date_of_birth: staff.date_of_birth || '',
      postal_code: staff.postal_code || '',
      prefecture: staff.prefecture || '',
      city: staff.city || '',
      address_line1: staff.address_line1 || '',
      address_line2: staff.address_line2 || '',
      bank_name: staff.bank_name || '',
      bank_branch: staff.bank_branch || '',
      bank_account_type: staff.bank_account_type || '',
      bank_account_number: staff.bank_account_number || '',
      bank_account_holder: staff.bank_account_holder || '',
      hire_date: staff.hire_date || '',
      notes: staff.notes || '',
      hourly_rate: staff.hourly_rate ?? '',
      daily_rate: staff.daily_rate ?? '',
      monthly_salary: staff.monthly_salary ?? '',
      transportation_allowance: staff.transportation_allowance ?? '',
    }
  }

  function computeChanges(newData: StaffFormValues): FieldChange[] {
    const original = getOriginalValues()
    const result: FieldChange[] = []

    for (const [key, newVal] of Object.entries(newData)) {
      const oldVal = original[key]
      const oldStr = formatValue(key, oldVal)
      const newStr = formatValue(key, newVal)

      if (oldStr !== newStr) {
        const label = FIELD_LABELS[key] || key
        result.push({ label, before: oldStr, after: newStr })
      }
    }

    return result
  }

  function computeChangedKeys(newData: StaffFormValues): string[] {
    const original = getOriginalValues()
    const keys: string[] = []
    for (const [key, newVal] of Object.entries(newData)) {
      const oldStr = formatValue(key, original[key])
      const newStr = formatValue(key, newVal)
      if (oldStr !== newStr) keys.push(key)
    }
    return keys
  }

  async function handleSubmit(data: StaffFormValues) {
    const detectedChanges = computeChanges(data)
    const changedKeys = computeChangedKeys(data)

    if (detectedChanges.length === 0) {
      toast.info('変更はありません')
      return
    }

    // 管理者の編集画面では報酬・雇用形態フィールドの変更を許可
    // (READONLY_FIELDS はスタッフ本人のプロフィール変更申請でのみ制限)

    pendingSubmitRef.current = { data, changedKeys }
    setChanges(detectedChanges)
    setAttachmentRequirement(computeAttachmentRequirement(changedKeys))
    setAttachmentUrls([])
    setShowConfirm(true)
  }

  async function handleConfirm() {
    if (!pendingSubmitRef.current) return
    const { data, changedKeys } = pendingSubmitRef.current

    // オーナーは即保存
    if (isOwner) {
      try {
        await mutateAsync({ data })
        toast.success('スタッフ情報を更新しました')
        router.push(`/staff/${id}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'スタッフの更新に失敗しました'
        toast.error(message)
      } finally {
        setShowConfirm(false)
        pendingSubmitRef.current = null
      }
      return
    }

    // 非オーナーは承認申請
    const req = computeAttachmentRequirement(changedKeys)
    if (needsAnyAttachment(req) && attachmentUrls.length === 0) {
      toast.error('本人確認書類の添付が必要です')
      return
    }

    // changesを { field: { from, to } } 形式に変換
    const original = getOriginalValues()
    const changesPayload: Record<string, { from: unknown; to: unknown }> = {}
    for (const k of changedKeys) {
      changesPayload[k] = { from: original[k] ?? null, to: (data as Record<string, unknown>)[k] ?? null }
    }

    try {
      const res = await fetch('/api/profile-change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: id,
          changes: changesPayload,
          attachment_urls: attachmentUrls,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || '申請に失敗しました')
        return
      }
      toast.success('変更申請を送信しました。オーナーの承認をお待ちください')
      router.push(`/staff/${id}`)
    } catch {
      toast.error('申請に失敗しました')
    } finally {
      setShowConfirm(false)
      pendingSubmitRef.current = null
    }
  }

  // 添付ファイルをSupabase Storageにアップロード
  async function handleFileUpload(file: File) {
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('staff_id', id)
      const res = await fetch('/api/profile-change-requests/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        toast.error('アップロード失敗')
        return
      }
      const data = await res.json()
      if (data.url) setAttachmentUrls(prev => [...prev, data.url])
    } catch {
      toast.error('アップロード失敗')
    }
  }

  if (isLoadingStaff) {
    return (
      <div className="space-y-6">
        <PageHeader title="スタッフ編集" />
        <LoadingSkeleton variant="form" rows={8} />
      </div>
    )
  }

  if (!staff) {
    return (
      <div className="space-y-6">
        <PageHeader title="スタッフ編集" />
        <p className="text-muted-foreground">スタッフが見つかりません</p>
      </div>
    )
  }

  const defaultValues: Partial<StaffFormValues> = {
    staff_code: staff.staff_code || '',
    employment_type: staff.employment_type as StaffFormValues['employment_type'],
    last_name: staff.last_name || '',
    first_name: staff.first_name || '',
    last_name_kana: staff.last_name_kana || '',
    first_name_kana: staff.first_name_kana || '',
    email: staff.email,
    phone: staff.phone || '',
    date_of_birth: staff.date_of_birth || '',
    address_line1: staff.address_line1 || '',
    address_line2: staff.address_line2 || '',
    personal_email: staff.personal_email || '',
    gender: staff.gender || '',
    postal_code: staff.postal_code || '',
    prefecture: staff.prefecture || '',
    city: staff.city || '',
    last_name_eiji: staff.last_name_eiji || '',
    first_name_eiji: staff.first_name_eiji || '',
    bank_name: staff.bank_name || '',
    bank_branch: staff.bank_branch || '',
    bank_account_type: staff.bank_account_type || '',
    bank_account_number: staff.bank_account_number || '',
    bank_account_holder: staff.bank_account_holder || '',
    hire_date: staff.hire_date || '',
    notes: staff.notes || '',
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="スタッフ編集"
        description={`${staff.last_name} ${staff.first_name} の情報を編集`}
      />
      <StaffForm
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        isLoading={isPending}
        showProvisioning={false}
      />
      <ConfirmChangesDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        changes={changes}
        onConfirm={handleConfirm}
        isLoading={isPending}
        submitMode={isOwner ? 'save' : 'request'}
        attachmentRequirement={attachmentRequirement}
        attachmentUrls={attachmentUrls}
        onUploadFile={handleFileUpload}
      />
    </div>
  )
}
