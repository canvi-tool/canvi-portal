'use client'

import { useState, useMemo, useCallback } from 'react'
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
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
  AlertTriangle,
  ArrowRightLeft,
  Wrench,
  Check,
  RotateCcw,
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
  deleted_at: string | null
  category: CategoryCode | null
  maker: MakerCode | null
}

export interface StaffOption {
  id: string
  last_name: string
  first_name: string
  status: string
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

// ---------- Status change config ----------

const STATUS_CHANGE_ICONS: Record<string, React.ReactNode> = {
  available: <PackageCheck className="h-4 w-4 text-green-600" />,
  lent: <Package className="h-4 w-4 text-blue-600" />,
  maintenance: <Wrench className="h-4 w-4 text-amber-600" />,
  disposed: <PackageX className="h-4 w-4 text-gray-500" />,
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
  initialTrashed: EquipmentItem[]
}

export function EquipmentPageClient({
  initialEquipment,
  initialLending,
  categoryCodes: initialCategoryCodes,
  makerCodes: initialMakerCodes,
  staffList,
  initialTrashed,
}: EquipmentPageClientProps) {
  const router = useRouter()

  // ===== Codes state (refreshable) =====
  const [categoryCodes, setCategoryCodes] = useState<CategoryCode[]>(initialCategoryCodes)
  const [makerCodes, setMakerCodes] = useState<MakerCode[]>(initialMakerCodes)

  const refreshCodes = useCallback(async () => {
    try {
      const res = await fetch('/api/equipment/codes')
      if (res.ok) {
        const json = await res.json()
        setCategoryCodes(json.data.category_codes)
        setMakerCodes(json.data.maker_codes)
      }
    } catch {
      // silent fail — codes will refresh on next page load
    }
  }, [])

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

  // ===== Unsigned pledge staff =====
  const unsignedPledgeStaff = useMemo(() => {
    const names: string[] = []
    for (const r of initialLending) {
      if (!r.return_date && r.pledge_status === 'not_submitted' && r.staff) {
        const name = `${r.staff.last_name} ${r.staff.first_name}`
        if (!names.includes(name)) names.push(name)
      }
    }
    return names
  }, [initialLending])

  // ===== Borrower map: equipment_item_id → staff name =====
  const borrowerMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const r of initialLending) {
      if (!r.return_date && r.staff) {
        const name = `${r.staff.last_name} ${r.staff.first_name}`
        for (const item of r.items) {
          if (item.equipment_item_id) {
            map[item.equipment_item_id] = name
          }
        }
      }
    }
    return map
  }, [initialLending])

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
    if (!confirm('この備品をゴミ箱に移動しますか？')) return
    try {
      const res = await fetch(`/api/equipment/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'ゴミ箱への移動に失敗しました')
        return
      }
      toast.success('備品をゴミ箱に移動しました')
      handleRefresh()
    } catch {
      toast.error('ゴミ箱への移動に失敗しました')
    }
  }

  const handleRestoreEquipment = async (id: string) => {
    try {
      const res = await fetch(`/api/equipment/${id}/restore`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '復元に失敗しました')
        return
      }
      toast.success('備品を復元しました')
      handleRefresh()
    } catch {
      toast.error('復元に失敗しました')
    }
  }

  const handleChangeStatus = async (id: string, newStatus: string) => {
    const label = EQUIPMENT_STATUS_LABELS[newStatus] || newStatus
    if (newStatus === 'disposed') {
      if (!confirm('この備品を廃棄済にしますか？')) return
    }
    try {
      const res = await fetch(`/api/equipment/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'ステータス変更に失敗しました')
        return
      }
      toast.success(`ステータスを「${label}」に変更しました`)
      handleRefresh()
    } catch {
      toast.error('ステータス変更に失敗しました')
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
        <TabsList className="bg-muted/60 p-1 rounded-lg">
          <TabsTrigger
            value="inventory"
            className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold dark:data-[state=active]:bg-zinc-800 px-6 py-2 rounded-md transition-all"
          >
            <Package className="h-4 w-4 mr-2" />
            在庫管理
          </TabsTrigger>
          <TabsTrigger
            value="lending"
            className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold dark:data-[state=active]:bg-zinc-800 px-6 py-2 rounded-md transition-all"
          >
            <PackageCheck className="h-4 w-4 mr-2" />
            貸与管理
          </TabsTrigger>
          <TabsTrigger
            value="trash"
            className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold dark:data-[state=active]:bg-zinc-800 px-6 py-2 rounded-md transition-all"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            ゴミ箱
            {initialTrashed.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-[20px] px-1.5 text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {initialTrashed.length}
              </Badge>
            )}
          </TabsTrigger>
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
                    <TableHead>貸与先</TableHead>
                    <TableHead>所有者</TableHead>
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
                        <TableCell>
                          {item.status === 'lent' && borrowerMap[item.id]
                            ? <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{borrowerMap[item.id]}</span>
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>{item.owner || '-'}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<button className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors" />}
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
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                                  ステータス変更
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {Object.entries(EQUIPMENT_STATUS_LABELS).map(([statusKey, statusLabel]) => (
                                    <DropdownMenuItem
                                      key={statusKey}
                                      onClick={() => handleChangeStatus(item.id, statusKey)}
                                      disabled={item.status === statusKey}
                                      className={item.status === statusKey ? 'opacity-50' : ''}
                                    >
                                      <span className="mr-2">{STATUS_CHANGE_ICONS[statusKey]}</span>
                                      {statusLabel}
                                      {item.status === statusKey && (
                                        <Check className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                                      )}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteEquipment(item.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                ゴミ箱に移動
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
            {/* Unsigned pledge warning banner */}
            {unsignedPledgeStaff.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">貸与品契約が未締結のスタッフがいます</p>
                  <p className="mt-1">{unsignedPledgeStaff.join('、')}</p>
                </div>
              </div>
            )}

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

        {/* ==================== ゴミ箱タブ ==================== */}
        <TabsContent value="trash">
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-3 flex items-start gap-3">
              <Trash2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p>削除された備品はここに移動されます。復元ボタンで在庫管理に戻すことができます。</p>
              </div>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>管理番号</TableHead>
                    <TableHead>機器種別</TableHead>
                    <TableHead>品名（機種名）</TableHead>
                    <TableHead>削除前ステータス</TableHead>
                    <TableHead>所有者</TableHead>
                    <TableHead>削除日時</TableHead>
                    <TableHead className="w-[80px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialTrashed.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        ゴミ箱は空です
                      </TableCell>
                    </TableRow>
                  ) : (
                    initialTrashed.map((item) => (
                      <TableRow key={item.id} className="opacity-70 hover:opacity-100 transition-opacity">
                        <TableCell className="font-mono text-xs">
                          {item.management_number}
                        </TableCell>
                        <TableCell>{item.category?.name || item.category_code}</TableCell>
                        <TableCell>{item.product_name || '-'}</TableCell>
                        <TableCell>
                          <EquipmentStatusBadge status={item.status} />
                        </TableCell>
                        <TableCell>{item.owner || '-'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.deleted_at
                            ? new Date(item.deleted_at).toLocaleDateString('ja-JP', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestoreEquipment(item.id)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                            復元
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
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
        onCodesUpdated={refreshCodes}
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
