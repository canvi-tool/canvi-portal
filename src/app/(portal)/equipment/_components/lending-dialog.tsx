'use client'

import { useState, useMemo } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Star } from 'lucide-react'
import { PLEDGE_STATUS_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import type { CategoryCode, EquipmentItem, StaffOption } from './equipment-page-client'

interface LendingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffList: StaffOption[]
  availableEquipment: EquipmentItem[]
  categoryCodes: CategoryCode[]
  onSuccess: () => void
}

interface SelectedItem {
  equipment_item_id: string
  is_main_device: boolean
}

export function LendingDialog({
  open,
  onOpenChange,
  staffList,
  availableEquipment,
  categoryCodes,
  onSuccess,
}: LendingDialogProps) {
  const [staffId, setStaffId] = useState('')
  const [lendingDate, setLendingDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [pledgeStatus, setPledgeStatus] = useState('not_submitted')
  const [pcPinCode, setPcPinCode] = useState('')
  const [remarks, setRemarks] = useState('')
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Group available equipment by category
  const groupedEquipment = useMemo(() => {
    const groups: Record<string, { categoryName: string; items: EquipmentItem[] }> = {}
    for (const item of availableEquipment) {
      const key = item.category_code
      if (!groups[key]) {
        const cat = categoryCodes.find((c) => c.code === key)
        groups[key] = {
          categoryName: cat?.name || key,
          items: [],
        }
      }
      groups[key].items.push(item)
    }
    return Object.entries(groups)
  }, [availableEquipment, categoryCodes])

  const toggleItem = (equipmentItemId: string) => {
    setSelectedItems((prev) => {
      const existing = prev.find((s) => s.equipment_item_id === equipmentItemId)
      if (existing) {
        return prev.filter((s) => s.equipment_item_id !== equipmentItemId)
      }
      return [...prev, { equipment_item_id: equipmentItemId, is_main_device: false }]
    })
  }

  const toggleMainDevice = (equipmentItemId: string) => {
    setSelectedItems((prev) =>
      prev.map((s) => ({
        ...s,
        is_main_device: s.equipment_item_id === equipmentItemId ? !s.is_main_device : false,
      }))
    )
  }

  const resetForm = () => {
    setStaffId('')
    setLendingDate(new Date().toISOString().split('T')[0])
    setPledgeStatus('not_submitted')
    setPcPinCode('')
    setRemarks('')
    setSelectedItems([])
  }

  const handleSubmit = async () => {
    if (!staffId) {
      toast.error('スタッフを選択してください')
      return
    }
    if (!lendingDate) {
      toast.error('貸与日を入力してください')
      return
    }
    if (selectedItems.length === 0) {
      toast.error('貸与品を1つ以上選択してください')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/equipment/lending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          lending_date: lendingDate,
          pledge_status: pledgeStatus || null,
          pc_pin_code: pcPinCode || null,
          remarks: remarks || null,
          items: selectedItems,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '貸与登録に失敗しました')
        return
      }

      toast.success('貸与を登録しました')
      resetForm()
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error('貸与登録に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:!max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>貸与登録</DialogTitle>
          <DialogDescription>
            スタッフへの備品貸与を登録します。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Staff select */}
          <div className="grid gap-1.5">
            <Label>スタッフ *</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="スタッフを選択" />
              </SelectTrigger>
              <SelectContent>
                {staffList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.last_name} {s.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lending date */}
          <div className="grid gap-1.5">
            <Label>貸与日 *</Label>
            <Input
              type="date"
              value={lendingDate}
              onChange={(e) => setLendingDate(e.target.value)}
            />
          </div>

          {/* Pledge status */}
          <div className="grid gap-1.5">
            <Label>誓約書</Label>
            <Select value={pledgeStatus} onValueChange={setPledgeStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="選択してください">
                  {PLEDGE_STATUS_LABELS[pledgeStatus] || pledgeStatus}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLEDGE_STATUS_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PC PIN */}
          <div className="grid gap-1.5">
            <Label>PC起動PINコード</Label>
            <Input
              value={pcPinCode}
              onChange={(e) => setPcPinCode(e.target.value)}
              placeholder="例: 1234"
            />
          </div>

          {/* Remarks */}
          <div className="grid gap-1.5">
            <Label>備考</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="備考を入力..."
              rows={2}
            />
          </div>

          {/* Equipment selection */}
          <div className="grid gap-1.5">
            <Label>貸与品選択 *</Label>
            <p className="text-xs text-muted-foreground">
              貸与する備品にチェックを入れ、メイン端末には星マークを付けてください。
            </p>
            {groupedEquipment.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                在庫中の備品がありません
              </p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto rounded-md border p-3">
                {groupedEquipment.map(([code, group]) => (
                  <div key={code}>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">
                      {group.categoryName}
                    </p>
                    <div className="space-y-1.5">
                      {group.items.map((item) => {
                        const selected = selectedItems.find(
                          (s) => s.equipment_item_id === item.id
                        )
                        const isSelected = !!selected
                        const isMain = selected?.is_main_device ?? false
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={isSelected}
                              onChange={() => toggleItem(item.id)}
                            />
                            <span className="flex-1 text-sm">
                              <span className="font-mono text-xs text-muted-foreground mr-1.5">
                                {item.management_number}
                              </span>
                              {item.product_name || '-'}
                            </span>
                            {isSelected && (
                              <button
                                type="button"
                                onClick={() => toggleMainDevice(item.id)}
                                className="p-0.5"
                                title="メイン端末に設定"
                              >
                                <Star
                                  className={`h-4 w-4 ${
                                    isMain
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-muted-foreground'
                                  }`}
                                />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedItems.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{selectedItems.length}点選択中</Badge>
                {selectedItems.find((s) => s.is_main_device) && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    メイン端末設定済
                  </span>
                )}
              </div>
            )}
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
            登録
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
