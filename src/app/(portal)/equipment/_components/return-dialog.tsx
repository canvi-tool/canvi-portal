'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { LendingRecord } from './equipment-page-client'

interface ReturnDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: LendingRecord
  onSuccess: () => void
}

export function ReturnDialog({
  open,
  onOpenChange,
  record,
  onSuccess,
}: ReturnDialogProps) {
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [submitting, setSubmitting] = useState(false)

  const staffName = record.staff
    ? `${record.staff.last_name} ${record.staff.first_name}`
    : '-'

  const handleSubmit = async () => {
    if (!returnDate) {
      toast.error('返却日を入力してください')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/equipment/lending/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_date: returnDate }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '返却処理に失敗しました')
        return
      }

      toast.success('返却処理が完了しました')
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error('返却処理に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:!max-w-sm">
        <DialogHeader>
          <DialogTitle>返却処理</DialogTitle>
          <DialogDescription>
            備品の返却を記録します。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {/* Record details */}
          <div className="rounded-md border p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">スタッフ</span>
              <span className="font-medium">{staffName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">貸与日</span>
              <span>{record.lending_date}</span>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-1">貸与品</p>
              <ul className="space-y-1">
                {record.items.map((item) => (
                  <li key={item.id} className="text-xs flex items-center gap-1.5">
                    <span className="font-mono text-muted-foreground">
                      {item.equipment_item?.management_number || '-'}
                    </span>
                    <span>{item.equipment_item?.product_name || '-'}</span>
                    {item.is_main_device && (
                      <span className="text-[10px] text-amber-600 font-medium">
                        メイン
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Return date */}
          <div className="grid gap-1.5">
            <Label>返却日 *</Label>
            <Input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            返却を確定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
