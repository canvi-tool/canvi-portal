/**
 * 機密フィールドフィルタリング
 * マイナンバー法・個人情報保護法に基づき、ロールに応じて機密フィールドを除外する
 */

// 銀行口座情報（owner/adminのみ）
const BANK_FIELDS = [
  'bank_name',
  'bank_branch',
  'bank_account_type',
  'bank_account_number',
  'bank_account_holder',
] as const

// 個人識別情報（owner/adminのみ、ただし本人は閲覧可）
const PERSONAL_SENSITIVE_FIELDS = [
  'date_of_birth',
  'postal_code',
  'prefecture',
  'city',
  'address_line1',
  'address_line2',
  'emergency_contact_name',
  'emergency_contact_phone',
  'emergency_contact_relationship',
  'personal_email',
] as const

// 報酬情報（owner/adminのみ）
const COMPENSATION_FIELDS = [
  'hourly_rate',
  'daily_rate',
  'monthly_salary',
  'transportation_allowance',
] as const

// custom_fieldsから除外すべきキー
const SENSITIVE_CUSTOM_FIELDS = [
  'identity_document',
  'onboarding_token',
  'info_update_token',
] as const

type StaffRecord = Record<string, unknown>

/**
 * staffロールのユーザーに返すデータから機密フィールドを除外する
 * @param staff スタッフレコード
 * @param isOwnRecord 本人のレコードかどうか
 * @returns フィルタリング済みのスタッフレコード
 */
export function filterStaffFieldsForStaffRole(
  staff: StaffRecord,
  isOwnRecord: boolean = false
): StaffRecord {
  const filtered = { ...staff }

  // 銀行口座情報は常に除外（staffロールでは閲覧不可）
  for (const field of BANK_FIELDS) {
    delete filtered[field]
  }

  // 報酬情報は常に除外
  for (const field of COMPENSATION_FIELDS) {
    delete filtered[field]
  }

  // 他人の個人情報は除外（本人のレコードなら閲覧可）
  if (!isOwnRecord) {
    for (const field of PERSONAL_SENSITIVE_FIELDS) {
      delete filtered[field]
    }
  }

  // custom_fieldsの機密フィールドを除外
  if (filtered.custom_fields && typeof filtered.custom_fields === 'object') {
    const cf = { ...(filtered.custom_fields as Record<string, unknown>) }
    for (const field of SENSITIVE_CUSTOM_FIELDS) {
      delete cf[field]
    }
    filtered.custom_fields = cf
  }

  return filtered
}

/**
 * スタッフレコード配列をフィルタリング
 */
export function filterStaffListForStaffRole(
  staffList: StaffRecord[],
  currentStaffId?: string | null
): StaffRecord[] {
  return staffList.map((staff) =>
    filterStaffFieldsForStaffRole(staff, staff.id === currentStaffId)
  )
}
