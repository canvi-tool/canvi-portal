'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import { StaffStatusBadge, getEffectiveStatus } from './staff-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EMPLOYMENT_TYPE_LABELS } from '@/lib/constants'
import { Trash2, MessageSquare } from 'lucide-react'
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
      key: 'google',
      header: 'Google',
      accessor: (row) => (row.user_id ? '1' : '0'),
      sortable: false,
      cell: (row) => {
        const hasGoogle = !!row.user_id
        return (
          <span
            title={hasGoogle ? 'Google連携済み' : 'Google未連携'}
            className={`flex justify-center ${hasGoogle ? 'text-emerald-600' : 'text-muted-foreground/30'}`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          </span>
        )
      },
      className: 'w-[70px]',
    },
    {
      key: 'slack',
      header: 'Slack',
      accessor: (row) => {
        const cf = row.custom_fields as Record<string, unknown> | null
        return cf?.slack_user_id ? '1' : '0'
      },
      sortable: false,
      cell: (row) => {
        const cf = row.custom_fields as Record<string, unknown> | null
        const hasSlack = !!(cf?.slack_user_id)
        return (
          <span
            title={hasSlack ? `Slack連携済み` : 'Slack未連携'}
            className={`flex justify-center ${hasSlack ? 'text-emerald-600' : 'text-muted-foreground/30'}`}
          >
            <MessageSquare className="h-4 w-4" />
          </span>
        )
      },
      className: 'w-[70px]',
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
