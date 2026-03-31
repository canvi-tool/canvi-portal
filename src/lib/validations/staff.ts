import { z } from 'zod'

export const staffFormSchema = z.object({
  staff_code: z.string(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'temporary', 'freelance', 'executive', 'other'], {
    error: '雇用区分を選択してください',
  }),
  last_name: z.string().min(1, '姓は必須です'),
  first_name: z.string().min(1, '名は必須です'),
  last_name_kana: z.string().optional(),
  first_name_kana: z.string().optional(),
  last_name_eiji: z.string().optional(),
  first_name_eiji: z.string().optional(),
  email: z.string().min(1, 'メールアドレスは必須です').email('メールアドレスの形式が正しくありません'),
  personal_email: z.string().optional(),
  phone: z.string().optional().refine(
    (v) => !v || /^\d{2,4}-\d{2,4}-\d{3,4}$/.test(v),
    { message: '電話番号の形式が正しくありません（例: 090-1234-5678）' }
  ),
  gender: z.string().optional(),
  date_of_birth: z.string().optional(),
  postal_code: z.string().optional().refine(
    (v) => !v || /^\d{3}-\d{4}$/.test(v),
    { message: '郵便番号は000-0000の形式で入力してください' }
  ),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  bank_name: z.string().optional(),
  bank_branch: z.string().optional(),
  bank_account_type: z.string().optional(),
  bank_account_number: z.string().optional().refine(
    (v) => !v || /^\d{7}$/.test(v),
    { message: '口座番号は半角数字7桁で入力してください' }
  ),
  bank_account_holder: z.string().optional().refine(
    (v) => !v || /^[\u30A0-\u30FFー（）\u3000 ]+$/.test(v),
    { message: '口座名義はカタカナと（）で入力してください' }
  ),
  hire_date: z.string().optional(),
  hourly_rate: z.number().nullable().optional(),
  daily_rate: z.number().nullable().optional(),
  monthly_salary: z.number().nullable().optional(),
  transportation_allowance: z.number().nullable().optional(),
  notes: z.string().optional(),
})

export type StaffFormValues = z.infer<typeof staffFormSchema>

export const staffSearchSchema = z.object({
  search: z.string().optional().default(''),
  status: z.string().optional().default(''),
  employment_type: z.string().optional().default(''),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
})

export type StaffSearchParams = z.infer<typeof staffSearchSchema>

/** オンボーディング招待スキーマ（オーナーが入力） */
export const staffInviteSchema = z.object({
  last_name: z.string().min(1, '姓は必須です'),
  first_name: z.string().min(1, '名は必須です'),
  personal_email: z.string().min(1, 'メールアドレスは必須です').email('メールアドレスの形式が正しくありません'),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'temporary', 'freelance'], {
    error: '雇用区分を選択してください',
  }),
})

export type StaffInviteValues = z.infer<typeof staffInviteSchema>

/** 社員系の雇用区分（社員・パート・契約・派遣） */
export const EMPLOYEE_TYPES = ['full_time', 'part_time', 'contract', 'temporary'] as const
/** 業務委託系 */
export const FREELANCE_TYPES = ['freelance'] as const

export function isEmployeeType(type: string): boolean {
  return (EMPLOYEE_TYPES as readonly string[]).includes(type)
}

/** 緊急連絡先の続柄選択肢 */
export const EMERGENCY_RELATIONSHIP_OPTIONS = [
  { value: '配偶者', label: '配偶者' },
  { value: '父', label: '父' },
  { value: '母', label: '母' },
  { value: '兄弟姉妹', label: '兄弟姉妹' },
  { value: '子', label: '子' },
  { value: '祖父母', label: '祖父母' },
  { value: '友人', label: '友人' },
  { value: 'その他', label: 'その他' },
] as const

/** 本人確認書類の種類 */
export const ID_DOCUMENT_TYPES = [
  { value: 'drivers_license', label: '運転免許証', frontLabel: '表面', backLabel: '裏面' },
  { value: 'my_number_card', label: 'マイナンバーカード', frontLabel: '表面', backLabel: '裏面' },
  { value: 'passport', label: 'パスポート', frontLabel: '顔写真ページ', backLabel: '所持人記入欄（住所記載ページ）' },
  { value: 'residence_card', label: '在留カード', frontLabel: '表面', backLabel: '裏面' },
  { value: 'health_insurance', label: '健康保険証', frontLabel: '表面', backLabel: '裏面' },
] as const

/** オンボーディングフォーム共通ベーススキーマ */
const onboardingBase = z.object({
  last_name: z.string().min(1, '姓は必須です'),
  first_name: z.string().min(1, '名は必須です'),
  last_name_kana: z.string().min(1, '姓（カナ）は必須です'),
  first_name_kana: z.string().min(1, '名（カナ）は必須です'),
  last_name_eiji: z.string().min(1, '姓（ローマ字）は必須です').refine(
    (v) => /^[a-z]+$/i.test(v),
    { message: 'ローマ字（アルファベット）で入力してください' }
  ),
  first_name_eiji: z.string().min(1, '名（ローマ字）は必須です').refine(
    (v) => /^[a-z]+$/i.test(v),
    { message: 'ローマ字（アルファベット）で入力してください' }
  ),
  date_of_birth: z.string().min(1, '生年月日は必須です'),
  gender: z.string().optional(),
  phone: z.string().min(1, '電話番号は必須です'),
  postal_code: z.string().optional(),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  bank_name: z.string().optional(),
  bank_branch: z.string().optional(),
  bank_account_type: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_account_holder: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relationship: z.string().optional(),
  emergency_contact_relationship_other: z.string().optional(),
  employment_type: z.string().optional(),
})

/** 業務委託向けバリデーション（住所・性別 + 銀行口座が必須） */
export const staffOnboardingSchema = onboardingBase.superRefine((data, ctx) => {
  if (!data.gender) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '性別は必須です', path: ['gender'] })
  }
  if (!data.postal_code) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '郵便番号は必須です', path: ['postal_code'] })
  }
  if (!data.prefecture) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '都道府県は必須です', path: ['prefecture'] })
  }
  if (!data.address_line1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '住所は必須です', path: ['address_line1'] })
  }
  if (!data.bank_name) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '銀行名は必須です', path: ['bank_name'] })
  }
  if (!data.bank_branch) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '支店名は必須です', path: ['bank_branch'] })
  }
  if (!data.bank_account_number) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '口座番号は必須です', path: ['bank_account_number'] })
  }
  if (!data.bank_account_holder) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '口座名義は必須です', path: ['bank_account_holder'] })
  }
})

/** 社員向け追加バリデーション（住所全体 + 緊急連絡先も必須） */
export const employeeOnboardingSchema = onboardingBase.superRefine((data, ctx) => {
  if (!data.postal_code) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '郵便番号は必須です', path: ['postal_code'] })
  }
  if (!data.prefecture) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '都道府県は必須です', path: ['prefecture'] })
  }
  if (!data.address_line1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '住所は必須です', path: ['address_line1'] })
  }
  if (!data.emergency_contact_name) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '緊急連絡先の氏名は必須です', path: ['emergency_contact_name'] })
  }
  if (!data.emergency_contact_phone) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '緊急連絡先の電話番号は必須です', path: ['emergency_contact_phone'] })
  }
  if (!data.bank_name) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '銀行名は必須です', path: ['bank_name'] })
  }
  if (!data.bank_branch) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '支店名は必須です', path: ['bank_branch'] })
  }
  if (!data.bank_account_number) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '口座番号は必須です', path: ['bank_account_number'] })
  }
  if (!data.bank_account_holder) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '口座名義は必須です', path: ['bank_account_holder'] })
  }
})

export type StaffOnboardingValues = z.infer<typeof staffOnboardingSchema>
