'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import { StaffStatusBadge, getEffectiveStatus } from './staff-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/constants'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Tables } from '@/lib/types/database'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Staff = Tables<'staff'>

/** Googleアカウント未発行（user_id が null）かつオンボーディング中のスタッフか */
function isDeletableStaff(staff: Staff): boolean {
  if (staff.user_id) return false
  const cf = staff.custom_fields as Record<string, unknown> | null
  const effectiveStatus = getEffectiveStatus(staff.status, cf)
  return ['pending_registration', 'pending_approval'].includes(effectiveStatus)
}

interface StaffTableProps {
  data: Staff[]
  loading?: boolean
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  onDelete?: (id: string) => void
}

export function StaffTable({ data, loading, selectable, selectedIds, onSelectionChange, onDelete }: StaffTableProps) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/staff/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || '削除に失敗しました')
      }
      toast.success(`${deleteTarget.last_name} ${deleteTarget.first_name} を削除しました`)
      onDelete?.(deleteTarget.id)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const columns: DataTableColumn<Staff>[] = [
    {
      key: 'staff_code',
      header: 'スタッフコード',
      accessor: (row) => row.staff_code || '',
      className: 'w-[140px]',
    },
    {
      key: 'name',
      header: '名前',
      accessor: (row) => `${row.last_name} ${row.first_name}`,
      cell: (row) => (
        <button
          className="text-left font-medium text-primary hover:underline"
          onClick={() => router.push(`/staff/${row.id}`)}
        >
          {row.last_name} {row.first_name}
        </button>
      ),
    },
    {
      key: 'employment_type',
      header: '雇用区分',
      accessor: (row) => row.employment_type,
      cell: (row) => (
        <Badge variant="outline">
          {EMPLOYMENT_TYPE_LABELS[row.employment_type] ?? row.employment_type}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'ステータス',
      accessor: (row) => row.status,
      cell: (row) => {
        const cf = row.custom_fields as Record<string, unknown> | null
        return <StaffStatusBadge status={row.status} customFields={cf} />
      },
    },
    {
      key: 'email',
      header: 'メール',
      accessor: (row) => row.email,
      className: 'hidden md:table-cell',
    },
    {
      key: 'hire_date',
      header: '入職日',
      accessor: (row) => row.hire_date,
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.hire_date || '-'}
        </span>
      ),
      className: 'hidden lg:table-cell w-[120px]',
    },
    {
      key: 'actions',
      header: '',
      accessor: () => '',
      cell: (row) =>
        isDeletableStaff(row) ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              setDeleteTarget(row)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null,
      className: 'w-[48px]',
    },
  ]

  return (
    <>
      <DataTable<Staff>
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage="スタッフが登録されていません"
        defaultSortKey="staff_code"
        keyExtractor={(row) => row.id}
        selectable={selectable}
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>スタッフを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  <strong>{deleteTarget.last_name} {deleteTarget.first_name}</strong>（{deleteTarget.email}）を削除します。この操作は取り消せません。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '削除中...' : '削除する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
