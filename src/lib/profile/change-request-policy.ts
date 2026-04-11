/**
 * プロフィール変更申請: フィールド分類と添付要件判定
 */

/** プロフ画面から編集不可（報酬・雇用形態など） */
export const READONLY_FIELDS = new Set<string>([
  'employment_type',
  'hourly_rate',
  'daily_rate',
  'monthly_salary',
  'transportation_allowance',
  'standard_monthly_remuneration',
  'salary_type',
])

/** 個人識別情報: 変更時は身分証添付必須 */
export const IDENTITY_FIELDS = new Set<string>([
  'last_name',
  'first_name',
  'last_name_kana',
  'first_name_kana',
  'last_name_eiji',
  'first_name_eiji',
  'date_of_birth',
])

/** 住所系: 変更時は住所確認書類添付必須 */
export const ADDRESS_FIELDS = new Set<string>([
  'postal_code',
  'prefecture',
  'city',
  'address_line1',
  'address_line2',
])

/** 口座情報 (口座名義のみ特別扱い) */
export const BANK_HOLDER_FIELD = 'bank_account_holder'

/** 緊急連絡先: 承認後、履歴テーブルに追加 */
export const EMERGENCY_CONTACT_FIELDS = new Set<string>([
  'emergency_contact_name',
  'emergency_contact_phone',
  'emergency_contact_relation',
])

export interface AttachmentRequirement {
  requiresIdentityDoc: boolean
  requiresAddressDoc: boolean
  requiresBankHolderDoc: boolean
}

export function computeAttachmentRequirement(changedKeys: string[]): AttachmentRequirement {
  let identity = false
  let address = false
  let bankHolder = false
  for (const k of changedKeys) {
    if (IDENTITY_FIELDS.has(k)) identity = true
    if (ADDRESS_FIELDS.has(k)) address = true
    if (k === BANK_HOLDER_FIELD) bankHolder = true
  }
  return {
    requiresIdentityDoc: identity,
    requiresAddressDoc: address,
    requiresBankHolderDoc: bankHolder,
  }
}

export function needsAnyAttachment(req: AttachmentRequirement): boolean {
  return req.requiresIdentityDoc || req.requiresAddressDoc || req.requiresBankHolderDoc
}

export function filterEditableChanges(
  changes: Record<string, { from: unknown; to: unknown }>
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {}
  for (const [k, v] of Object.entries(changes)) {
    if (!READONLY_FIELDS.has(k)) out[k] = v
  }
  return out
}
