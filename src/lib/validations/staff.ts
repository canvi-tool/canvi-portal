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
})

export type StaffInviteValues = z.infer<typeof staffInviteSchema>

/** オンボーディングフォームスキーマ（スタッフ本人が入力） */
export const staffOnboardingSchema = z.object({
  last_name: z.string().min(1, '姓は必須です'),
  first_name: z.string().min(1, '名は必須です'),
  last_name_kana: z.string().min(1, '姓（カナ）は必須です'),
  first_name_kana: z.string().min(1, '名（カナ）は必須です'),
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
})

export type StaffOnboardingValues = z.infer<typeof staffOnboardingSchema>
