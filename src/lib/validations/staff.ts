import { z } from 'zod'

export const staffFormSchema = z.object({
  staff_code: z.string().min(1, 'スタッフコードは必須です'),
  employment_type: z.enum(['employee', 'contractor', 'freelancer'], {
    error: '雇用区分を選択してください',
  }),
  last_name: z.string().min(1, '姓は必須です'),
  first_name: z.string().min(1, '名は必須です'),
  last_name_kana: z.string(),
  first_name_kana: z.string(),
  email: z.string().email('メールアドレスの形式が正しくありません'),
  phone: z.string(),
  date_of_birth: z.string(),
  address: z.string(),
  bank_name: z.string(),
  bank_branch: z.string(),
  bank_account_type: z.string(),
  bank_account_number: z.string(),
  bank_account_holder: z.string(),
  join_date: z.string(),
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
