import { z } from 'zod'

export const staffFormSchema = z.object({
  staff_code: z.string().min(1, 'スタッフコードは必須です'),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'temporary', 'freelance'], {
    error: '雇用区分を選択してください',
  }),
  last_name: z.string().min(1, '姓は必須です'),
  first_name: z.string().min(1, '名は必須です'),
  last_name_kana: z.string(),
  first_name_kana: z.string(),
  last_name_eiji: z.string(),
  first_name_eiji: z.string(),
  email: z.string().email('メールアドレスの形式が正しくありません'),
  personal_email: z.string(),
  phone: z.string(),
  gender: z.string(),
  date_of_birth: z.string(),
  postal_code: z.string(),
  prefecture: z.string(),
  city: z.string(),
  address_line1: z.string(),
  address_line2: z.string(),
  bank_name: z.string(),
  bank_branch: z.string(),
  bank_account_type: z.string(),
  bank_account_number: z.string(),
  bank_account_holder: z.string(),
  hire_date: z.string(),
  hourly_rate: z.number().nullable().optional(),
  daily_rate: z.number().nullable().optional(),
  monthly_salary: z.number().nullable().optional(),
  transportation_allowance: z.number().nullable().optional(),
  notes: z.string(),
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
