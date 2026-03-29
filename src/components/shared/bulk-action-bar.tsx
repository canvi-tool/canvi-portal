'use client'

import { type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BulkActionBarProps {
  selectedCount: number
  totalCount: number
  onClearSelection: () => void
  children: ReactNode
  className?: string
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onClearSelection,
  children,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'bg-primary text-primary-foreground shadow-2xl rounded-xl',
        'px-5 py-3 flex items-center gap-4',
        'animate-in slide-in-from-bottom-4 fade-in duration-200',
        className
      )}
    >
      <span className="text-sm font-medium whitespace-nowrap">
        {selectedCount.toLocaleString('ja-JP')}件を選択中
        {totalCount > 0 && (
          <span className="opacity-70 ml-1">/ {totalCount.toLocaleString('ja-JP')}件</span>
        )}
      </span>

      <div className="h-5 w-px bg-primary-foreground/30" />

      <div className="flex items-center gap-2">
        {children}
      </div>

      <div className="h-5 w-px bg-primary-foreground/30" />

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="text-primary-foreground hover:bg-primary-foreground/20 h-8 px-2"
      >
        <X className="h-4 w-4 mr-1" />
        解除
      </Button>
    </div>
  )
}
