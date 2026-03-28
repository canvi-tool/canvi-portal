'use client'

import { cn } from '@/lib/utils'
import { Check, FileText, Pen, ShieldCheck, Play, XCircle, Timer } from 'lucide-react'
import type { ContractStatus } from '@/lib/types/enums'

interface StatusStep {
  status: ContractStatus
  label: string
  icon: React.ElementType
}

const STATUS_STEPS: StatusStep[] = [
  { status: 'draft', label: '下書き', icon: FileText },
  { status: 'pending_signature', label: '署名待ち', icon: Pen },
  { status: 'signed', label: '署名済み', icon: ShieldCheck },
  { status: 'active', label: '有効', icon: Play },
]

const TERMINAL_STATUSES: Record<string, { label: string; icon: React.ElementType }> = {
  expired: { label: '期限切れ', icon: Timer },
  terminated: { label: '解約済み', icon: XCircle },
}

const STATUS_LABELS: Record<ContractStatus, string> = {
  draft: '下書き',
  pending_signature: '署名待ち',
  signed: '署名済み',
  active: '有効',
  expired: '期限切れ',
  terminated: '解約済み',
}

interface StatusTimelineEntry {
  status: string
  timestamp: string | null
}

interface ContractStatusTrackerProps {
  currentStatus: ContractStatus
  createdAt?: string
  signedAt?: string | null
  updatedAt?: string
  className?: string
}

function getStatusIndex(status: ContractStatus): number {
  return STATUS_STEPS.findIndex((s) => s.status === status)
}

function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function ContractStatusTracker({
  currentStatus,
  createdAt,
  signedAt,
  updatedAt,
  className,
}: ContractStatusTrackerProps) {
  const isTerminal = currentStatus in TERMINAL_STATUSES
  const currentIndex = getStatusIndex(currentStatus)

  // Build timeline entries
  const timelineEntries: StatusTimelineEntry[] = STATUS_STEPS.map((step) => {
    let timestamp: string | null = null
    if (step.status === 'draft') timestamp = createdAt || null
    if (step.status === 'signed') timestamp = signedAt || null
    if (step.status === currentStatus) timestamp = updatedAt || null
    return { status: step.status, timestamp }
  })

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {STATUS_STEPS.map((step, index) => {
          const isCompleted = !isTerminal && currentIndex > index
          const isCurrent = currentStatus === step.status
          const isPending = !isTerminal && currentIndex < index
          const Icon = step.icon

          return (
            <div key={step.status} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                    isCompleted && 'border-green-500 bg-green-500 text-white',
                    isCurrent && 'border-blue-500 bg-blue-50 text-blue-600',
                    isPending && 'border-gray-300 bg-white text-gray-400',
                    isTerminal && currentIndex >= index && 'border-orange-400 bg-orange-50 text-orange-600',
                    isTerminal && currentIndex < index && 'border-gray-300 bg-white text-gray-400'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={cn(
                    'mt-2 text-xs font-medium',
                    isCompleted && 'text-green-600',
                    isCurrent && 'text-blue-600',
                    isPending && 'text-gray-400',
                    isTerminal && currentIndex >= index && 'text-orange-600',
                    isTerminal && currentIndex < index && 'text-gray-400'
                  )}
                >
                  {step.label}
                </span>
                {timelineEntries[index]?.timestamp && (
                  <span className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatTimestamp(timelineEntries[index].timestamp)}
                  </span>
                )}
              </div>
              {index < STATUS_STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 flex-1',
                    !isTerminal && currentIndex > index
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Terminal status indicator */}
      {isTerminal && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2">
          {(() => {
            const termInfo = TERMINAL_STATUSES[currentStatus]
            const TermIcon = termInfo.icon
            return (
              <>
                <TermIcon className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-700">
                  現在のステータス: {termInfo.label}
                </span>
                {updatedAt && (
                  <span className="ml-auto text-xs text-orange-500">
                    {formatTimestamp(updatedAt)}
                  </span>
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const colorMap: Record<ContractStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending_signature: 'bg-yellow-100 text-yellow-700',
    signed: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    expired: 'bg-orange-100 text-orange-700',
    terminated: 'bg-red-100 text-red-700',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorMap[status] || 'bg-gray-100 text-gray-700'
      )}
    >
      {STATUS_LABELS[status] || status}
    </span>
  )
}
