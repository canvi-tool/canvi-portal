'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Plus, Trash2 } from 'lucide-react'

export type DocumentItemRowType = 'item' | 'text'

export interface DocumentItem {
  name: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  amount: number
  row_type?: DocumentItemRowType
}

export interface DocumentItemsTableProps {
  items: DocumentItem[]
  onChange: (items: DocumentItem[]) => void
  taxRate: number
  onTaxRateChange: (rate: number) => void
  readOnly?: boolean
}

function createEmptyItem(): DocumentItem {
  return {
    name: '',
    description: '',
    quantity: 1,
    unit: '式',
    unit_price: 0,
    amount: 0,
    row_type: 'item',
  }
}

function createEmptyTextRow(): DocumentItem {
  return {
    name: '',
    description: '',
    quantity: 0,
    unit: '',
    unit_price: 0,
    amount: 0,
    row_type: 'text',
  }
}

function isTextRow(item: DocumentItem): boolean {
  return item.row_type === 'text'
}

export function DocumentItemsTable({
  items,
  onChange,
  taxRate,
  onTaxRateChange,
  readOnly = false,
}: DocumentItemsTableProps) {
  const subtotal = items.reduce(
    (sum, item) => (isTextRow(item) ? sum : sum + item.amount),
    0
  )
  const taxAmount = Math.floor(subtotal * (taxRate / 100))
  const total = subtotal + taxAmount

  const updateItem = (
    index: number,
    field: keyof DocumentItem,
    value: string | number
  ) => {
    const updated = [...items]
    const item = { ...updated[index] }

    if (field === 'quantity' || field === 'unit_price') {
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value
      ;(item as Record<string, unknown>)[field] = numValue
      item.amount =
        (field === 'quantity' ? numValue : item.quantity) *
        (field === 'unit_price' ? numValue : item.unit_price)
    } else {
      ;(item as Record<string, unknown>)[field] = value
    }

    updated[index] = item
    onChange(updated)
  }

  const addItem = () => {
    onChange([...items, createEmptyItem()])
  }

  const addTextRow = () => {
    onChange([...items, createEmptyTextRow()])
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const formatCurrency = (value: number) =>
    `\u00a5${value.toLocaleString('ja-JP')}`

  const totalCols = readOnly ? 6 : 7

  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">品名</TableHead>
              <TableHead className="min-w-[160px]">説明</TableHead>
              <TableHead className="w-[80px] text-right">数量</TableHead>
              <TableHead className="w-[80px]">単位</TableHead>
              <TableHead className="w-[120px] text-right">単価</TableHead>
              <TableHead className="w-[120px] text-right">金額</TableHead>
              {!readOnly && <TableHead className="w-[50px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={totalCols}
                  className="h-20 text-center text-muted-foreground"
                >
                  品目がありません
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                if (isTextRow(item)) {
                  return (
                    <TableRow key={index}>
                      <TableCell colSpan={6}>
                        {readOnly ? (
                          <span className="text-sm whitespace-pre-wrap">
                            {item.description}
                          </span>
                        ) : (
                          <Input
                            value={item.description}
                            onChange={(e) =>
                              updateItem(index, 'description', e.target.value)
                            }
                            placeholder="テキストを入力 (小計には含まれません)"
                            className="h-8"
                          />
                        )}
                      </TableCell>
                      {!readOnly && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                }

                return (
                  <TableRow key={index}>
                    <TableCell>
                      {readOnly ? (
                        <span className="text-sm">{item.name}</span>
                      ) : (
                        <Input
                          value={item.name}
                          onChange={(e) => updateItem(index, 'name', e.target.value)}
                          placeholder="品名を入力"
                          className="h-8"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <span className="text-sm text-muted-foreground">
                          {item.description}
                        </span>
                      ) : (
                        <Input
                          value={item.description}
                          onChange={(e) =>
                            updateItem(index, 'description', e.target.value)
                          }
                          placeholder="説明"
                          className="h-8"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <span className="text-sm text-right block">
                          {item.quantity}
                        </span>
                      ) : (
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, 'quantity', e.target.value)
                          }
                          className="h-8 text-right"
                          min={0}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <span className="text-sm">{item.unit}</span>
                      ) : (
                        <Input
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                          placeholder="式"
                          className="h-8"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <span className="text-sm text-right block">
                          {formatCurrency(item.unit_price)}
                        </span>
                      ) : (
                        <Input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItem(index, 'unit_price', e.target.value)
                          }
                          className="h-8 text-right"
                          min={0}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatCurrency(item.amount)}
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" />
            品目を追加
          </Button>
          <Button variant="outline" size="sm" onClick={addTextRow}>
            <Plus className="h-4 w-4 mr-1" />
            テキスト行を追加
          </Button>
        </div>
      )}

      {/* Amount summary */}
      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">小計</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              消費税
              {readOnly ? (
                <span>({taxRate}%)</span>
              ) : (
                <Input
                  type="number"
                  value={taxRate}
                  onChange={(e) => onTaxRateChange(parseFloat(e.target.value) || 0)}
                  className="h-7 w-16 text-right text-xs"
                  min={0}
                  max={100}
                />
              )}
              {!readOnly && <span>%</span>}
            </span>
            <span>{formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2 font-bold">
            <span>合計</span>
            <span className="text-lg">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
