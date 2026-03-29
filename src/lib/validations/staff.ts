import { z } from 'zod'

export const staffFormSchema = z.object({
  staff_code: z.string().min(1, 'スタッフコードは必須です'),
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
  phone: z.string().optional(),
  gender: z.string().optional(),
  date_of_birth: z.string().optional(),
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

/** オンボーディングフォームスキーマ（スタッフ本人が入力） */
// 雇用区分に応じて必須項目が変わるので、superRefineで制御
export const staffOnboardingSchema = z.object({
  last_name: z.string().min(1, '姓は必須です'),
  first_name: z.string().min(1, '名は必須です'),
  last_name_kana: z.string().min(1, '姓（カナ）は必須です'),
  first_name_kana: z.string().min(1, '名（カナ）は必須です'),
  date_of_birth: z.string().optional(),
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
  // 雇用区分（フォームからは送らないが、サーバーで参照用）
  employment_type: z.string().optional(),
})

/** 社員向け追加バリデーション */
export const employeeOnboardingSchema = staffOnboardingSchema.superRefine((data, ctx) => {
  if (!data.date_of_birth) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '生年月日は必須です', path: ['date_of_birth'] })
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
