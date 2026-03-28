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
  | 'planning'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived'

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
