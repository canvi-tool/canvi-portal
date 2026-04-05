import { z } from 'zod'

// ========== 定数 ==========
export const LEAVE_TYPES = ['full_day', 'half_day_am', 'half_day_pm', 'hourly'] as const
export type LeaveType = typeof LEAVE_TYPES[number]

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  full_day: '全日',
  half_day_am: '午前半休',
  half_day_pm: '午後半休',
  hourly: '時間単位',
}

export const GRANT_TYPES = ['annual', 'special', 'compensatory'] as const
export type GrantType = typeof GRANT_TYPES[number]

export const GRANT_TYPE_LABELS: Record<GrantType, string> = {
  annual: '年次有給休暇',
  special: '特別休暇',
  compensatory: '代休',
}

export const LEAVE_REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const
export type LeaveRequestStatus = typeof LEAVE_REQUEST_STATUSES[number]

export const LEAVE_REQUEST_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  pending: '申請中',
  approved: '承認済',
  rejected: '却下',
  cancelled: '取消',
}

// ========== バリデーションスキーマ ==========

/** 有給申請スキーマ */
export const leaveRequestSchema = z.object({
  staff_id: z.string().min(1, 'スタッフは必須です'),
  start_date: z.string().min(1, '開始日は必須です'),
  end_date: z.string().min(1, '終了日は必須です'),
  leave_type: z.enum(LEAVE_TYPES, { error: '休暇種別を選択してください' }),
  hours: z.number().min(0.5).max(8).optional(),
  days: z.number().min(0.5, '日数は0.5以上を指定してください'),
  reason: z.string().optional(),
  leave_grant_id: z.string().optional(),
}).refine((data) => data.start_date <= data.end_date, {
  message: '終了日は開始日以降にしてください',
  path: ['end_date'],
}).refine((data) => {
  if (data.leave_type === 'hourly' && !data.hours) {
    return false
  }
  return true
}, {
  message: '時間単位の場合は時間を指定してください',
  path: ['hours'],
})

export type LeaveRequestValues = z.infer<typeof leaveRequestSchema>

/** 有給付与スキーマ */
export const leaveGrantSchema = z.object({
  staff_id: z.string().min(1, 'スタッフは必須です'),
  grant_date: z.string().min(1, '付与日は必須です'),
  expiry_date: z.string().min(1, '有効期限は必須です'),
  grant_type: z.enum(GRANT_TYPES).default('annual'),
  total_days: z.number().min(0.5, '付与日数は0.5以上を指定してください'),
  note: z.string().optional(),
}).refine((data) => data.grant_date < data.expiry_date, {
  message: '有効期限は付与日より後にしてください',
  path: ['expiry_date'],
})

export type LeaveGrantValues = z.infer<typeof leaveGrantSchema>

/** 承認/却下スキーマ */
export const leaveApprovalSchema = z.object({
  action: z.enum(['approve', 'reject'], { error: 'アクションを指定してください' }),
  comment: z.string().optional(),
})

export type LeaveApprovalValues = z.infer<typeof leaveApprovalSchema>

/** クエリパラメータスキーマ */
export const leaveRequestQuerySchema = z.object({
  staff_id: z.string().optional(),
  status: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

export type LeaveRequestQueryParams = z.infer<typeof leaveRequestQuerySchema>
