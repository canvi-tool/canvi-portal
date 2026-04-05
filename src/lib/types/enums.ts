export type EmploymentType = 'employee' | 'contractor' | 'freelancer'

export type StaffStatus =
  | 'pre_contract'
  | 'contract_sent'
  | 'pending_signature'
  | 'active'
  | 'on_leave'
  | 'retired'

export type ContractStatus =
  | 'draft'
  | 'pending_signature'
  | 'signed'
  | 'active'
  | 'expired'
  | 'terminated'

export type ProjectStatus =
  | 'proposing'
  | 'active'
  | 'ended'

export type AssignmentStatus = 'pending' | 'active' | 'suspended' | 'ended'

export type CompensationRuleType =
  | 'time_rate'
  | 'count_rate'
  | 'standby_rate'
  | 'monthly_fixed'
  | 'fixed_plus_variable'
  | 'percentage'
  | 'adjustment'

export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export type PaymentStatus =
  | 'draft'
  | 'aggregated'
  | 'needs_review'
  | 'confirmed'
  | 'issued'

export type NotificationType =
  | 'payment_notification'
  | 'contract_reminder'
  | 'alert'
  | 'retirement_document'

export type NotificationDeliveryStatus = 'pending' | 'sent' | 'failed' | 'resent'

export type AlertType =
  | 'unreported_work'
  | 'shift_discrepancy'
  | 'unsigned_contract'
  | 'failed_notification'
  | 'unsigned_retirement_doc'
  | 'anomaly_detected'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'textarea'

export const SHIFT_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  NEEDS_REVISION: 'NEEDS_REVISION',
} as const

export type ShiftStatus = typeof SHIFT_STATUS[keyof typeof SHIFT_STATUS]

export const SHIFT_APPROVAL_MODE = {
  AUTO: 'AUTO',
  APPROVAL: 'APPROVAL',
} as const

export type ShiftApprovalMode = typeof SHIFT_APPROVAL_MODE[keyof typeof SHIFT_APPROVAL_MODE]

export const SHIFT_APPROVAL_ACTION = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  NEEDS_REVISION: 'NEEDS_REVISION',
  MODIFY: 'MODIFY',
  COMMENT: 'COMMENT',
} as const

export type ShiftApprovalAction = typeof SHIFT_APPROVAL_ACTION[keyof typeof SHIFT_APPROVAL_ACTION]
