import { z } from 'zod'

export const clientFormSchema = z.object({
  client_code: z.string().min(1, 'クライアントコードは必須です'),
  name: z.string().min(1, 'クライアント名は必須です'),
  name_kana: z.string().optional(),
  contact_person: z.string().optional(),
  contact_email: z.string().email('メールアドレスの形式が正しくありません').or(z.literal('')).optional(),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
  industry: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive']),
})

export type ClientFormValues = z.infer<typeof clientFormSchema>

export const clientSearchSchema = z.object({
  search: z.string().optional().default(''),
  status: z.string().optional().default(''),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
})

export type ClientSearchParams = z.infer<typeof clientSearchSchema>
