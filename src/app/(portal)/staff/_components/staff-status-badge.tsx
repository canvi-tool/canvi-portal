import { StatusBadge } from '@/components/shared/status-badge'
import { STAFF_STATUS_LABELS } from '@/lib/constants'

interface StaffStatusBadgeProps {
  status: string
}

export function StaffStatusBadge({ status }: StaffStatusBadgeProps) {
  return <StatusBadge status={status} labels={STAFF_STATUS_LABELS} />
}
