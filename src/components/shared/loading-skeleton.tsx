import { Skeleton } from '@/components/ui/skeleton'

interface LoadingSkeletonProps {
  variant: 'card' | 'table' | 'form'
  rows?: number
}

function CardSkeleton({ rows = 4 }: { rows: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border p-6 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

function TableSkeleton({ rows = 5 }: { rows: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4 px-4 py-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-20" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function FormSkeleton({ rows = 6 }: { rows: number }) {
  return (
    <div className="space-y-6 max-w-2xl">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex gap-3 pt-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  )
}

export function LoadingSkeleton({ variant, rows }: LoadingSkeletonProps) {
  switch (variant) {
    case 'card':
      return <CardSkeleton rows={rows ?? 4} />
    case 'table':
      return <TableSkeleton rows={rows ?? 5} />
    case 'form':
      return <FormSkeleton rows={rows ?? 6} />
    default:
      return null
  }
}
