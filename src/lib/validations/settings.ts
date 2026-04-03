import { z } from 'zod'

// ========== ロール管理 ==========

export const assignRoleSchema = z.object({
  user_id: z.string().min(1, 'ユーザーIDは必須です'),
  role_id: z.string().min(1, 'ロールIDは必須です'),
})

export const removeRoleSchema = z.object({
  user_id: z.string().min(1, 'ユーザーIDは必須です'),
  role_id: z.string().min(1, 'ロールIDは必須です'),
})

export const updateRolePermissionsSchema = z.object({
  role_id: z.string().min(1, 'ロールIDは必須です'),
  permission_ids: z.array(z.string()),
})

export type AssignRoleInput = z.infer<typeof assignRoleSchema>
export type RemoveRoleInput = z.infer<typeof removeRoleSchema>
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>

