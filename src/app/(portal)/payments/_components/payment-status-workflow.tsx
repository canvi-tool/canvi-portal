'use client'

import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'

const WORKFLOW_STEPS = [
  { key: 'draft', label: '下書き' },
  { key: 'aggregated', label: '集計済' },
  { key: 'needs_review', label: '要確認' },
  { key: 'confirmed', label: '確定済' },
  { key: 'issued', label: '発行済' },
] as const

interface PaymentStatusWorkflowProps {
  currentStatus: string
}

export function PaymentStatusWorkflow({ currentStatus }: PaymentStatusWorkflowProps) {
  const currentIndex = WORKFLOW_STEPS.findIndex((s) => s.key === currentStatus)

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {WORKFLOW_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isSkipped =
          step.key === 'needs_review' &&
          currentStatus !== 'needs_review' &&
          currentIndex > 2

        if (isSkipped) return null

        return (
          <div key={step.key} className="flex items-center gap-1">
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                isCurrent && 'bg-primary text-primary-foreground',
                isCompleted && 'bg-primary/10 text-primary',
                !isCurrent && !isCompleted && 'bg-muted text-muted-foreground'
              )}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : isCurrent ? (
                <Circle className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
              {step.label}
            </div>
            {index < WORKFLOW_STEPS.length - 1 && !isSkipped && (
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}
