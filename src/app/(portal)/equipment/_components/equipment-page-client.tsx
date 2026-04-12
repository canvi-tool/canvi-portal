'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Package,
  PackageCheck,
  PackageX,
  Undo2,
} from 'lucide-react'
import {
  EQUIPMENT_STATUS_LABELS,
  PLEDGE_STATUS_LABELS,
} from '@/lib/constants'
import { EquipmentAddDialog } from './equipment-add-dialog'
import { LendingDialog } from './lending-dialog'
import { ReturnDialog } from './return-dialog'
import { toast } from 'sonner'

// ---------- Types ----------

export interface CategoryCode {
  code: string
  name: string
}

export interface MakerCode {
  code: string
  name: string
}

export interface EquipmentItem {
  id: string
  management_number: string
  category_code: string
  maker_code: string
  serial_number: number
  product_name: string | null
  status: string
  owner: string | null
  purchase_date: string | null
  remarks: string | null
  created_at: string
  category: CategoryCode | null
  maker: MakerCode | null
}

export interface StaffOption {
  id: string
  last_name: string
  first_name: string
}

export interface LendingItem {
  id: string
  equipment_item_id: string
  is_main_device: boolean
  remarks: string | null
  equipment_item: {
    id: string
    management_number: string
    product_name: string | null
    status: string
    category: CategoryCode | null
    maker: MakerCode | null
  } | null
}

export interface LendingRecord {
  id: string
  staff_id: string
  lending_date: string
  return_date: string | null
  pledge_status: string | null
  pc_pin_code: string | null
  remarks: string | null
  created_at: string
  staff: { id: string; last_name: string; first_name: string } | null
  items: LendingItem[]
}

// ---------- Status badge helpers ----------

const STATUS_BADGE_CLASSES: Record<string, string> = {
  available: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  lent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  disposed: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400',
  maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const PLEDGE_BADGE_CLASSES: Record<string, string> = {
  signed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  not_submitted: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function EquipmentStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={STATUS_BADGE_CLASSES[status] || ''}>
      {EQUIPMENT_STATUS_LABELS[status] || status}
    </Badge>
  )
}

function PledgeStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={PLEDGE_BADGE_CLASSES[status] || ''}>
      {PLEDGE_STATUS_LABELS[status] || status}
    </Badge>
  )
}

// ---------- Stats ----------

const STAT_ICONS: Record<string, React.ReactNode> = {
  total: <Package className="h-4 w-4 text-muted-foreground" />,
  available: <PackageCheck className="h-4 w-4 text-green-600" />,
  lent: <Package className="h-4 w-4 text-blue-600" />,
  disposed: <PackageX className="h-4 w-4 text-gray-500" />,
}

// ---------- Component ----------

interface EquipmentPageClientProps {
  initialEquipment: EquipmentItem[]
  initialLending: LendingRecord[]
  categoryCodes: CategoryCode[]
  makerCodes: MakerCode[]
  staffList: StaffOption[]
}

export function EquipmentPageClient({
  initialEquipment,
  initialLending,
  categoryCodes,
  makerCodes,
  staffList,
}: EquipmentPageClientProps) {
  const router = useRouter()

  // ===== Equipment tab state =====
  const [eqSearch, setEqSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<EquipmentItem | null>(null)

  // ===== Lending tab state =====
  const [lendSearch, setLendSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [lendDialogOpen, setLendDialogOpen] = useState(false)
  const [returnRecord, setReturnRecord] = useState<LendingRecord | null>(null)

  // ===== Equipment filtering =====
  const filteredEquipment = useMemo(() => {
    let result = initialEquipment
    if (eqSearch) {
      const q = eqSearch.toLowerCase()
      result = result.filter(
        (item) =>
          (item.product_name || '').toLowerCase().includes(q) ||
          item.management_number.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      result = result.filter((item) => item.status === statusFilter)
    }
    if (categoryFilter) {
      result = result.filter((item) => item.category_code === categoryFilter)
    }
    return result
  }, [initialEquipment, eqSearch, statusFilter, categoryFilter])

  // ===== Lending filtering =====
  const filteredLending = useMemo(() => {
    let result = initialLending
    if (lendSearch) {
      const q = lendSearch.toLowerCase()
      result = result.filter((r) => {
        const name = r.staff
          ? `${r.staff.last_name} ${r.staff.first_name}`.toLowerCase()
          : ''
        return name.includes(q)
      })
    }
    if (activeOnly) {
      result = result.filter((r) => !r.return_date)
    }
    return result
  }, [initialLending, lendSearch, activeOnly])

  // ===== Equipment stats =====
  const stats = useMemo(() => {
    const total = initialEquipment.length
    const available = initialEquipment.filter((i) => i.status === 'available').length
    const lent = initialEquipment.filter((i) => i.status === 'lent').length
    const disposed = initialEquipment.filter((i) => i.status === 'disposed').length
    return { total, available, lent, disposed }
  }, [initialEquipment])

  // ===== Handlers =====
  const handleRefresh = () => {
    router.refresh()
  }

  const handleDeleteEquipment = async (id: string) => {
    if (!confirm('この備品を削除しますか？')) return
    try {
      const res = await fetch(`/api/equipment/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '削除に失敗しました')
        return
      }
      toast.success('備品を削除しました')
      handleRefresh()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  // ===== Category labels for filter =====
  const categoryLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    for (const c of categoryCodes) {
      labels[c.code] = c.name
    }
    return labels
  }, [categoryCodes])

  return (
    <>
      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">在庫管理</TabsTrigger>
          <TabsTrigger value="lending">貸与管理</TabsTrigger>
        </TabsList>

        {/* ==================== 在庫管理タブ ==================== */}
        <TabsContent value="inventory">
          <div className="space-y-4">
            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { key: 'total', label: '合計', value: stats.total },
                { key: 'available', label: '在庫中', value: stats.available },
                { key: 'lent', label: '貸与中', value: stats.lent },
                { key: 'disposed', label: '廃棄済', value: stats.disposed },
              ].map((s) => (
                <Card key={s.key} size="sm">
                  <CardContent className="flex items-center gap-3 px-4 py-3">
                    {STAT_ICONS[s.key]}
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-lg font-semibold">{s.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filters + add button */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="品名・管理番号で検索..."
                    value={eqSearch}
                    onChange={(e) => setEqSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(val) => setStatusFilter(val || null)}
                >
                  <SelectTrigger>
                    <SelectValueWithLabel
                      value={statusFilter}
                      labels={EQUIPMENT_STATUS_LABELS}
                      placeholder="ステータス"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">すべて</SelectItem>
                    {Object.entries(EQUIPMENT_STATUS_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={categoryFilter}
                  onValueChange={(val) => setCategoryFilter(val || null)}
                >
                  <SelectTrigger>
                    <SelectValueWithLabel
                      value={categoryFilter}
                      labels={categoryLabels}
                      placeholder="機器種別"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">すべて</SelectItem>
                    {categoryCodes.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                機器追加
              </Button>
            </div>

            {/* Equipment table */}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>管理番号</TableHead>
                    <TableHead>機器種別</TableHead>
                    <TableHead>品名（機種名）</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>所有者</TableHead>
                    <TableHead>備考</TableHead>
                    <TableHead className="w-[60px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEquipment.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        備品が見つかりません
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEquipment.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">
                          {item.management_number}
                        </TableCell>
                        <TableCell>{item.category?.name || item.category_code}</TableCell>
                        <TableCell>{item.product_name || '-'}</TableCell>
                        <TableCell>
                          <EquipmentStatusBadge status={item.status} />
                        </TableCell>
                        <TableCell>{item.owner || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {item.remarks || '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon-sm" />}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setEditItem(item)}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                編集
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteEquipment(item.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                削除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ==================== 貸与管理タブ ==================== */}
        <TabsContent value="lending">
          <div className="space-y-4">
            {/* Filters + add button */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="スタッフ名で検索..."
                    value={lendSearch}
                    onChange={(e) => setLendSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="active-only"
                    checked={activeOnly}
                    onCheckedChange={setActiveOnly}
                  />
                  <Label htmlFor="active-only" className="text-sm cursor-pointer">
                    未返却のみ
                  </Label>
                </div>
              </div>
              <Button onClick={() => setLendDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                貸与登録
              </Button>
            </div>

            {/* Lending table */}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>氏名</TableHead>
                    <TableHead>貸与日</TableHead>
                    <TableHead>返却日</TableHead>
                    <TableHead>誓約書</TableHead>
                    <TableHead>貸与機器</TableHead>
                    <TableHead>その他備品</TableHead>
                    <TableHead>PC PIN</TableHead>
                    <TableHead>備考</TableHead>
                    <TableHead className="w-[60px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        貸与記録が見つかりません
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLending.map((record) => {
                      const mainDevice = record.items.find((i) => i.is_main_device)
                      const otherCount = record.items.filter((i) => !i.is_main_device).length
                      return (
                        <TableRow key={record.id}>
                          <TableCell>
                            {record.staff
                              ? `${record.staff.last_name} ${record.staff.first_name}`
                              : '-'}
                          </TableCell>
                          <TableCell>{record.lending_date}</TableCell>
                          <TableCell>
                            {record.return_date || (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                未返却
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.pledge_status ? (
                              <PledgeStatusBadge status={record.pledge_status} />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {mainDevice?.equipment_item ? (
                              <div>
                                <span className="text-xs">
                                  {mainDevice.equipment_item.product_name || ''}
                                </span>
                                <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                                  {mainDevice.equipment_item.management_number}
                                </span>
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {otherCount > 0 ? `${otherCount}点` : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {record.pc_pin_code || '-'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {record.remarks || '-'}
                          </TableCell>
                          <TableCell>
                            {!record.return_date && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setReturnRecord(record)}
                                title="返却処理"
                              >
                                <Undo2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== Dialogs ===== */}
      <EquipmentAddDialog
        open={addDialogOpen || !!editItem}
        onOpenChange={(open) => {
          if (!open) {
            setAddDialogOpen(false)
            setEditItem(null)
          }
        }}
        categoryCodes={categoryCodes}
        makerCodes={makerCodes}
        editItem={editItem}
        onSuccess={handleRefresh}
      />

      <LendingDialog
        open={lendDialogOpen}
        onOpenChange={setLendDialogOpen}
        staffList={staffList}
        availableEquipment={initialEquipment.filter((i) => i.status === 'available')}
        categoryCodes={categoryCodes}
        onSuccess={handleRefresh}
      />

      {returnRecord && (
        <ReturnDialog
          open={!!returnRecord}
          onOpenChange={(open) => {
            if (!open) setReturnRecord(null)
          }}
          record={returnRecord}
          onSuccess={handleRefresh}
        />
      )}
    </>
  )
}
