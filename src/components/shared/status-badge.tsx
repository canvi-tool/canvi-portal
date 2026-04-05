import { Badge } from '@/components/ui/badge'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

interface StatusBadgeProps {
  status: string
  labels: Record<string, string>
  variants?: Record<string, BadgeVariant>
}

const DEFAULT_VARIANT_MAP: Record<string, BadgeVariant> = {
  active: 'default',
  signed: 'default',
  confirmed: 'default',
  approved: 'default',
  draft: 'outline',
  proposing: 'outline',
  planning: 'outline',
  pre_contract: 'outline',
  pending_registration: 'secondary',
  pending_approval: 'secondary',
  pending_signature: 'secondary',
  contract_sent: 'secondary',
  submitted: 'secondary',
  aggregated: 'secondary',
  needs_review: 'secondary',
  on_leave: 'secondary',
  ended: 'secondary',
  paused: 'secondary',
  completed: 'secondary',
  archived: 'secondary',
  issued: 'secondary',
  expired: 'destructive',
  terminated: 'destructive',
  retired: 'destructive',
  rejected: 'destructive',
  critical: 'destructive',
  warning: 'secondary',
  info: 'outline',
}

export function StatusBadge({ status, labels, variants }: StatusBadgeProps) {
  const variantMap = variants ?? DEFAULT_VARIANT_MAP
  const variant = variantMap[status] ?? 'outline'
  const label = labels[status] ?? status

  return <Badge variant={variant}>{label}</Badge>
}
