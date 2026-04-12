'use client'

import { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus } from 'lucide-react'
import { EQUIPMENT_STATUS_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import type { CategoryCode, MakerCode, EquipmentItem } from './equipment-page-client'

// ---------- Code Add Dialog ----------

function CodeAddDialog({
  open,
  onOpenChange,
  type,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'category' | 'maker'
  onSaved: () => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setCode('')
      setName('')
    }
  }, [open])

  const handleSave = async () => {
    const upperCode = code.toUpperCase().trim()
    if (!/^[A-Z]{2,3}$/.test(upperCode)) {
      toast.error('コードは半角英大文字2〜3文字で入力してください')
      return
    }
    if (!name.trim()) {
      toast.error('名称は必須です')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/equipment/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, code: upperCode, name: name.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '追加に失敗しました')
        return
      }
      toast.success(type === 'category' ? '種別を追加しました' : 'メーカーを追加しました')
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('追加に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:!max-w-sm">
        <DialogHeader>
          <DialogTitle>{type === 'category' ? '種別追加' : 'メーカー追加'}</DialogTitle>
          <DialogDescription>
            {type === 'category'
              ? '新しい機器種別コードを登録します。'
              : '新しいメーカーコードを登録します。'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>コード（半角英大文字2〜3文字） *</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="例: PC"
              maxLength={3}
              className="font-mono uppercase"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>名称 *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'category' ? '例: パソコン' : '例: Apple'}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            追加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Equipment Add Dialog ----------

interface EquipmentAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryCodes: CategoryCode[]
  makerCodes: MakerCode[]
  editItem: EquipmentItem | null
  onSuccess: () => void
  onCodesUpdated?: () => void
}

export function EquipmentAddDialog({
  open,
  onOpenChange,
  categoryCodes,
  makerCodes,
  editItem,
  onSuccess,
  onCodesUpdated,
}: EquipmentAddDialogProps) {
  const isEdit = !!editItem

  const [categoryCode, setCategoryCode] = useState('')
  const [makerCode, setMakerCode] = useState('')
  const [productName, setProductName] = useState('')
  const [status, setStatus] = useState('available')
  const [owner, setOwner] = useState('Canvi')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Nested dialog state
  const [categoryAddOpen, setCategoryAddOpen] = useState(false)
  const [makerAddOpen, setMakerAddOpen] = useState(false)

  // Pre-fill for edit mode
  useEffect(() => {
    if (editItem) {
      setCategoryCode(editItem.category_code)
      setMakerCode(editItem.maker_code)
      setProductName(editItem.product_name || '')
      setStatus(editItem.status)
      setOwner(editItem.owner || 'Canvi')
      setPurchaseDate(editItem.purchase_date || '')
      setRemarks(editItem.remarks || '')
    } else {
      setCategoryCode('')
      setMakerCode('')
      setProductName('')
      setStatus('available')
      setOwner('Canvi')
      setPurchaseDate('')
      setRemarks('')
    }
  }, [editItem, open])

  // Management number preview — fetch next serial from API
  const [nextSerialPreview, setNextSerialPreview] = useState<string | null>(null)
  useEffect(() => {
    if (isEdit || !categoryCode || !makerCode) {
      setNextSerialPreview(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/equipment/codes/next-serial?category=${categoryCode}&maker=${makerCode}`)
        if (!res.ok) { setNextSerialPreview(null); return }
        const json = await res.json()
        if (!cancelled) setNextSerialPreview(json.data?.management_number ?? null)
      } catch {
        if (!cancelled) setNextSerialPreview(null)
      }
    })()
    return () => { cancelled = true }
  }, [categoryCode, makerCode, isEdit])

  const managementNumberPreview = isEdit
    ? editItem.management_number
    : nextSerialPreview ?? (categoryCode && makerCode ? `${categoryCode}${makerCode}--` : '-')

  const handleSubmit = async () => {
    if (!isEdit && (!categoryCode || !makerCode)) {
      toast.error('機器種別とメーカーは必須です')
      return
    }

    setSubmitting(true)
    try {
      const url = isEdit ? `/api/equipment/${editItem.id}` : '/api/equipment'
      const method = isEdit ? 'PUT' : 'POST'

      const body = isEdit
        ? { product_name: productName || null, status, owner: owner || null, purchase_date: purchaseDate || null, remarks: remarks || null }
        : { category_code: categoryCode, maker_code: makerCode, product_name: productName || null, status, owner: owner || null, purchase_date: purchaseDate || null, remarks: remarks || null }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '保存に失敗しました')
        return
      }

      toast.success(isEdit ? '備品を更新しました' : '備品を登録しました')
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCodeSaved = () => {
    onCodesUpdated?.()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:!max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? '備品編集' : '備品追加'}</DialogTitle>
            <DialogDescription>
              {isEdit ? '備品情報を編集します。' : '新しい備品を登録します。管理番号は自動採番されます。'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Category */}
            <div className="grid gap-1.5">
              <Label>機器種別 *</Label>
              <Select value={categoryCode} onValueChange={setCategoryCode} disabled={isEdit}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {categoryCodes.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}（{c.code}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Maker */}
            <div className="grid gap-1.5">
              <Label>メーカー *</Label>
              <Select value={makerCode} onValueChange={setMakerCode} disabled={isEdit}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {makerCodes.map((m) => (
                    <SelectItem key={m.code} value={m.code}>
                      {m.name}（{m.code}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product name */}
            <div className="grid gap-1.5">
              <Label>品名（機種名）</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="例: MacBook Pro 14インチ"
              />
            </div>

            {/* Management number preview */}
            <div className="grid gap-1.5">
              <Label>管理番号</Label>
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono">
                {managementNumberPreview}
              </div>
            </div>

            {/* Status */}
            <div className="grid gap-1.5">
              <Label>ステータス</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {EQUIPMENT_STATUS_LABELS[status] || status}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EQUIPMENT_STATUS_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Owner */}
            <div className="grid gap-1.5">
              <Label>所有者</Label>
              <Input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="Canvi"
              />
            </div>

            {/* Purchase date */}
            <div className="grid gap-1.5">
              <Label>購入日</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>

            {/* Remarks */}
            <div className="grid gap-1.5">
              <Label>備考</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="備考を入力..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCategoryAddOpen(true)}
                disabled={submitting}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                種別追加
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMakerAddOpen(true)}
                disabled={submitting}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                メーカー追加
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                キャンセル
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? '更新' : '登録'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nested dialogs for adding codes */}
      <CodeAddDialog
        open={categoryAddOpen}
        onOpenChange={setCategoryAddOpen}
        type="category"
        onSaved={handleCodeSaved}
      />
      <CodeAddDialog
        open={makerAddOpen}
        onOpenChange={setMakerAddOpen}
        type="maker"
        onSaved={handleCodeSaved}
      />
    </>
  )
}
