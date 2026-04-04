'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueWithLabel,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, Send, Loader2, Mail } from 'lucide-react'
import { StaffTable } from './staff-table'
import { BulkActionBar } from '@/components/shared/bulk-action-bar'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { STAFF_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS } from '@/lib/constants'
import { useBulkUpdateStaffStatus } from '@/hooks/use-staff'
import { getEffectiveStatus } from './staff-status-badge'
import { toast } from 'sonner'
import type { Tables } from '@/lib/types/database'

type Staff = Tables<'staff'>

interface StaffListClientProps {
  initialData: Staff[]
}

const BULK_STATUS_OPTIONS = [
  { value: 'active', label: '稼働中に変更' },
  { value: 'on_leave', label: '休止中に変更' },
  { value: 'retired', label: '退職/離任に変更' },
]

export function StaffListClient({ initialData }: StaffListClientProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [employmentFilter, setEmploymentFilter] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const bulkUpdate = useBulkUpdateStaffStatus()
  const [sendingInfoUpdate, setSendingInfoUpdate] = useState(false)
  const [sendingWelcomeEmail, setSendingWelcomeEmail] = useState(false)
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkCheckResults, setBulkCheckResults] = useState<Array<{ name: string; missingFields: string[] }>>([])

  const filteredData = useMemo(() => {
    let result = initialData

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((s) => {
        const fullName = `${s.last_name} ${s.first_name}`.toLowerCase()
        const fullNameKana = `${s.last_name_kana || ''} ${s.first_name_kana || ''}`.toLowerCase()
        const staffCode = (s.staff_code || '').toLowerCase()
        return (
          fullName.includes(q) ||
          fullNameKana.includes(q) ||
          s.email.toLowerCase().includes(q) ||
          staffCode.includes(q)
        )
      })
    }

    if (statusFilter) {
      result = result.filter((s) => {
        const cf = s.custom_fields as Record<string, unknown> | null
        return getEffectiveStatus(s.status, cf) === statusFilter
      })
    }

    if (employmentFilter) {
      result = result.filter((s) => s.employment_type === employmentFilter)
    }

    return result
  }, [initialData, search, statusFilter, employmentFilter])

  const handleBulkStatusChange = async (status: string) => {
    const ids = Array.from(selectedIds)
    try {
      const result = await bulkUpdate.mutateAsync({ ids, status })
      toast.success(`${result.updated}件のスタッフのステータスを更新しました`)
      setSelectedIds(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '一括更新に失敗しました')
    }
  }

  const handleBulkInfoUpdateCheck = async () => {
    const ids = Array.from(selectedIds)
    setSendingInfoUpdate(true)
    try {
      const results: Array<{ name: string; missingFields: string[] }> = []

      for (const id of ids) {
        const staff = initialData.find(s => s.id === id)
        const name = staff ? `${staff.last_name} ${staff.first_name}` : id
        try {
          const res = await fetch(`/api/staff/${id}/request-info-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ check_only: true }),
          })
          if (res.ok) {
            const data = await res.json()
            results.push({ name, missingFields: data.missing_fields || [] })
          } else {
            results.push({ name, missingFields: ['(確認失敗)'] })
          }
        } catch {
          results.push({ name, missingFields: ['(確認失敗)'] })
        }
      }

      setBulkCheckResults(results)
      setBulkConfirmOpen(true)
    } catch {
      toast.error('確認に失敗しました')
    } finally {
      setSendingInfoUpdate(false)
    }
  }

  const handleBulkInfoUpdateSend = async () => {
    setBulkConfirmOpen(false)
    const ids = Array.from(selectedIds)
    setSendingInfoUpdate(true)
    try {
      let successCount = 0
      let failCount = 0
      for (const id of ids) {
        try {
          const res = await fetch(`/api/staff/${id}/request-info-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
          if (res.ok) {
            successCount++
          } else {
            failCount++
          }
        } catch {
          failCount++
        }
      }
      if (failCount === 0) {
        toast.success(`${successCount}件の情報更新依頼を送信しました`)
      } else {
        toast.warning(`${successCount}件成功、${failCount}件失敗しました`)
      }
      setSelectedIds(new Set())
    } catch {
      toast.error('一括送信に失敗しました')
    } finally {
      setSendingInfoUpdate(false)
    }
  }

  const handleBulkWelcomeEmail = async () => {
    const ids = Array.from(selectedIds)
    const userIds = ids
      .map((id) => initialData.find((s) => s.id === id)?.user_id)
      .filter((uid): uid is string => !!uid)

    if (userIds.length === 0) {
      toast.error('ポータルアカウントが紐づいたスタッフが選択されていません')
      return
    }

    setSendingWelcomeEmail(true)
    try {
      const res = await fetch('/api/users/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: userIds }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'メール送信に失敗しました')
        return
      }
      toast.success(`${data.success_count}名にログイン案内メールを送信しました${data.fail_count ? `（${data.fail_count}名失敗）` : ''}`)
      setSelectedIds(new Set())
    } catch {
      toast.error('メール送信に失敗しました')
    } finally {
      setSendingWelcomeEmail(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="名前・コードで検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val || null)}
        >
          <SelectTrigger>
            <SelectValueWithLabel value={statusFilter} labels={STAFF_STATUS_LABELS} placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">すべて</SelectItem>
            {Object.entries(STAFF_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={employmentFilter}
          onValueChange={(val) => setEmploymentFilter(val || null)}
        >
          <SelectTrigger>
            <SelectValueWithLabel value={employmentFilter} labels={EMPLOYMENT_TYPE_LABELS} placeholder="雇用区分" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">すべて</SelectItem>
            {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <StaffTable
        data={filteredData}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={filteredData.length}
        onClearSelection={() => setSelectedIds(new Set())}
      >
        <Button
          variant="secondary"
          size="sm"
          disabled={sendingWelcomeEmail}
          onClick={handleBulkWelcomeEmail}
        >
          {sendingWelcomeEmail ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Mail className="h-3.5 w-3.5 mr-1.5" />
          )}
          ログイン案内メール
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={sendingInfoUpdate}
          onClick={handleBulkInfoUpdateCheck}
        >
          {sendingInfoUpdate ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5 mr-1.5" />
          )}
          情報更新依頼
        </Button>
        {BULK_STATUS_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant="secondary"
            size="sm"
            disabled={bulkUpdate.isPending}
            onClick={() => handleBulkStatusChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </BulkActionBar>

      {/* 一括情報更新依頼 確認ダイアログ */}
      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent className="!max-w-md sm:!max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>情報更新依頼の確認</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkCheckResults.length}名に情報更新依頼を送信します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-2 px-1">
            {bulkCheckResults.map((r, i) => (
              <div key={i} className="rounded-lg border p-2.5 text-sm">
                <div className="font-medium flex items-center gap-2">
                  {r.name}
                  {r.missingFields.length === 0 ? (
                    <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">入力済み</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] text-amber-700">未入力{r.missingFields.length}件</Badge>
                  )}
                </div>
                {r.missingFields.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.missingFields.join('、')}
                  </p>
                )}
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkInfoUpdateSend}>
              送信する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
