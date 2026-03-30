import { StatusBadge } from '@/components/shared/status-badge'
import { STAFF_STATUS_LABELS } from '@/lib/constants'

interface StaffStatusBadgeProps {
  status: string
  customFields?: Record<string, unknown> | null
}

/** custom_fields.onboarding_status がある場合はそちらを優先表示 */
export function getEffectiveStatus(status: string, customFields?: Record<string, unknown> | null): string {
  if (status === 'suspended' && customFields?.onboarding_status) {
    return customFields.onboarding_status as string
  }
  return status
}

export function StaffStatusBadge({ status, customFields }: StaffStatusBadgeProps) {
  const effectiveStatus = getEffectiveStatus(status, customFields)
  return <StatusBadge status={effectiveStatus} labels={STAFF_STATUS_LABELS} />
}
