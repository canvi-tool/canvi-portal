'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Check, Minus } from 'lucide-react'

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  indeterminate?: boolean
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, checked, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null)

    React.useImperativeHandle(ref, () => innerRef.current!)

    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = !!indeterminate
      }
    }, [indeterminate])

    const isChecked = indeterminate || checked

    return (
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          ref={innerRef}
          checked={checked}
          className="sr-only peer"
          {...props}
        />
        <div
          className={cn(
            'h-4 w-4 shrink-0 rounded border border-input ring-offset-background',
            'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            isChecked && 'bg-primary border-primary text-primary-foreground',
            className
          )}
        >
          {indeterminate ? (
            <Minus className="h-full w-full p-[1px]" />
          ) : checked ? (
            <Check className="h-full w-full p-[1px]" />
          ) : null}
        </div>
      </label>
    )
  }
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
