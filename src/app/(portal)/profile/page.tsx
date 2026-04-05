'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil, X, Loader2, Save } from 'lucide-react'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/constants'
import type { Tables } from '@/lib/types/database'

type Staff = Tables<'staff'>

const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
  '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
  '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
  '熊本県','大分県','宮崎県','鹿児島県','沖縄県',
]

const GENDER_LABELS: Record<string, string> = {
  male: '男性',
  female: '女性',
  other: 'その他',
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-sm">{value || '-'}</span>
    </div>
  )
}

async function fetchProfile(): Promise<Staff> {
  const res = await fetch('/api/profile')
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'プロフィールの取得に失敗しました' }))
    throw new Error(err.error || 'プロフィールの取得に失敗しました')
  }
  return res.json()
}

async function updateProfile(data: Record<string, unknown>): Promise<Staff> {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '更新に失敗しました' }))
    throw new Error(err.error || '更新に失敗しました')
  }
  return res.json()
}

type EditingSection = 'basic' | 'contact' | 'address' | 'bank' | 'emergency' | null

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const [editingSection, setEditingSection] = useState<EditingSection>(null)
  const [formData, setFormData] = useState<Record<string, string | null>>({})

  const { data: staff, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  })

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success('プロフィールを更新しました')
      setEditingSection(null)
      setFormData({})
    },
    onError: (err: Error) => {
      toast.error(err.message || '更新に失敗しました')
    },
  })

  function startEditing(section: EditingSection, fields: Record<string, string | null>) {
    setEditingSection(section)
    setFormData(fields)
  }

  function cancelEditing() {
    setEditingSection(null)
    setFormData({})
  }

  function handleFieldChange(key: string, value: string | null) {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    mutation.mutate(formData)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !staff) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">{(error as Error)?.message || 'プロフィールの取得に失敗しました'}</p>
      </div>
    )
  }

  const isEditing = (section: EditingSection) => editingSection === section

  function SectionEditButton({ section, fields }: { section: EditingSection; fields: Record<string, string | null> }) {
    if (isEditing(section)) {
      return (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={cancelEditing}
            disabled={mutation.isPending}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            キャンセル
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            保存
          </Button>
        </div>
      )
    }
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => startEditing(section, fields)}
        disabled={editingSection !== null}
      >
        <Pencil className="h-3.5 w-3.5 mr-1" />
        編集
      </Button>
    )
  }

  function EditableField({
    label,
    fieldKey,
    type = 'text',
  }: {
    label: string
    fieldKey: string
    type?: 'text' | 'date' | 'email' | 'tel'
  }) {
    return (
      <div className="space-y-1.5 py-2 border-b last:border-0">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        <Input
          type={type}
          value={formData[fieldKey] ?? ''}
          onChange={(e) => handleFieldChange(fieldKey, e.target.value || null)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="プロフィール"
        description="あなたの個人情報を確認・編集できます"
      />

      {/* 読み取り専用: 基本情報 */}
      <Card>
        <CardHeader>
          <CardTitle>アカウント情報</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="氏名" value={`${staff.last_name} ${staff.first_name}`} />
          <InfoRow label="メールアドレス" value={staff.email} />
          <InfoRow label="スタッフコード" value={staff.staff_code} />
          <InfoRow label="雇用形態" value={EMPLOYMENT_TYPE_LABELS[staff.employment_type] ?? staff.employment_type} />
          <InfoRow label="入職日" value={staff.hire_date} />
        </CardContent>
      </Card>

      {/* 基本情報（編集可能） */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>基本情報</CardTitle>
          <SectionEditButton
            section="basic"
            fields={{
              last_name_kana: staff.last_name_kana,
              first_name_kana: staff.first_name_kana,
              last_name_eiji: staff.last_name_eiji,
              first_name_eiji: staff.first_name_eiji,
              date_of_birth: staff.date_of_birth,
              gender: staff.gender,
            }}
          />
        </CardHeader>
        <CardContent>
          {isEditing('basic') ? (
            <div className="space-y-0">
              <EditableField label="姓（カナ）" fieldKey="last_name_kana" />
              <EditableField label="名（カナ）" fieldKey="first_name_kana" />
              <EditableField label="姓（英字）" fieldKey="last_name_eiji" />
              <EditableField label="名（英字）" fieldKey="first_name_eiji" />
              <EditableField label="生年月日" fieldKey="date_of_birth" type="date" />
              <div className="space-y-1.5 py-2 border-b last:border-0">
                <Label className="text-sm text-muted-foreground">性別</Label>
                <Select
                  value={formData.gender ?? ''}
                  onValueChange={(v) => handleFieldChange('gender', v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">男性</SelectItem>
                    <SelectItem value="female">女性</SelectItem>
                    <SelectItem value="other">その他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <>
              <InfoRow label="氏名（カナ）" value={`${staff.last_name_kana || ''} ${staff.first_name_kana || ''}`.trim() || null} />
              <InfoRow label="氏名（英字）" value={`${staff.last_name_eiji || ''} ${staff.first_name_eiji || ''}`.trim() || null} />
              <InfoRow label="生年月日" value={staff.date_of_birth} />
              <InfoRow label="性別" value={staff.gender ? (GENDER_LABELS[staff.gender] ?? staff.gender) : null} />
            </>
          )}
        </CardContent>
      </Card>

      {/* 連絡先 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>連絡先</CardTitle>
          <SectionEditButton
            section="contact"
            fields={{
              phone: staff.phone,
              personal_email: staff.personal_email,
            }}
          />
        </CardHeader>
        <CardContent>
          {isEditing('contact') ? (
            <div className="space-y-0">
              <EditableField label="電話番号" fieldKey="phone" type="tel" />
              <EditableField label="個人メールアドレス" fieldKey="personal_email" type="email" />
            </div>
          ) : (
            <>
              <InfoRow label="電話番号" value={staff.phone} />
              <InfoRow label="個人メール" value={staff.personal_email} />
            </>
          )}
        </CardContent>
      </Card>

      {/* 住所 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>住所</CardTitle>
          <SectionEditButton
            section="address"
            fields={{
              postal_code: staff.postal_code,
              prefecture: staff.prefecture,
              city: staff.city,
              address_line1: staff.address_line1,
              address_line2: staff.address_line2,
            }}
          />
        </CardHeader>
        <CardContent>
          {isEditing('address') ? (
            <div className="space-y-0">
              <EditableField label="郵便番号" fieldKey="postal_code" />
              <div className="space-y-1.5 py-2 border-b last:border-0">
                <Label className="text-sm text-muted-foreground">都道府県</Label>
                <Select
                  value={formData.prefecture ?? ''}
                  onValueChange={(v) => handleFieldChange('prefecture', v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {PREFECTURES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <EditableField label="市区町村" fieldKey="city" />
              <EditableField label="番地" fieldKey="address_line1" />
              <EditableField label="建物名・部屋番号" fieldKey="address_line2" />
            </div>
          ) : (
            <>
              <InfoRow label="郵便番号" value={staff.postal_code} />
              <InfoRow label="都道府県" value={staff.prefecture} />
              <InfoRow label="市区町村" value={staff.city} />
              <InfoRow label="番地" value={staff.address_line1} />
              <InfoRow label="建物名等" value={staff.address_line2} />
            </>
          )}
        </CardContent>
      </Card>

      {/* 銀行口座 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>銀行口座</CardTitle>
          <SectionEditButton
            section="bank"
            fields={{
              bank_name: staff.bank_name,
              bank_branch: staff.bank_branch,
              bank_account_type: staff.bank_account_type,
              bank_account_number: staff.bank_account_number,
              bank_account_holder: staff.bank_account_holder,
            }}
          />
        </CardHeader>
        <CardContent>
          {isEditing('bank') ? (
            <div className="space-y-0">
              <EditableField label="銀行名" fieldKey="bank_name" />
              <EditableField label="支店名" fieldKey="bank_branch" />
              <div className="space-y-1.5 py-2 border-b last:border-0">
                <Label className="text-sm text-muted-foreground">口座種別</Label>
                <Select
                  value={formData.bank_account_type ?? ''}
                  onValueChange={(v) => handleFieldChange('bank_account_type', v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="普通">普通</SelectItem>
                    <SelectItem value="当座">当座</SelectItem>
                    <SelectItem value="貯蓄">貯蓄</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <EditableField label="口座番号" fieldKey="bank_account_number" />
              <EditableField label="口座名義" fieldKey="bank_account_holder" />
            </div>
          ) : (
            <>
              <InfoRow label="銀行名" value={staff.bank_name} />
              <InfoRow label="支店名" value={staff.bank_branch} />
              <InfoRow label="口座種別" value={staff.bank_account_type} />
              <InfoRow label="口座番号" value={staff.bank_account_number} />
              <InfoRow label="口座名義" value={staff.bank_account_holder} />
            </>
          )}
        </CardContent>
      </Card>

      {/* 緊急連絡先 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>緊急連絡先</CardTitle>
          <SectionEditButton
            section="emergency"
            fields={{
              emergency_contact_name: staff.emergency_contact_name,
              emergency_contact_phone: staff.emergency_contact_phone,
              emergency_contact_relationship: staff.emergency_contact_relationship,
            }}
          />
        </CardHeader>
        <CardContent>
          {isEditing('emergency') ? (
            <div className="space-y-0">
              <EditableField label="氏名" fieldKey="emergency_contact_name" />
              <EditableField label="電話番号" fieldKey="emergency_contact_phone" type="tel" />
              <EditableField label="続柄" fieldKey="emergency_contact_relationship" />
            </div>
          ) : (
            <>
              <InfoRow label="氏名" value={staff.emergency_contact_name} />
              <InfoRow label="電話番号" value={staff.emergency_contact_phone} />
              <InfoRow label="続柄" value={staff.emergency_contact_relationship} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
