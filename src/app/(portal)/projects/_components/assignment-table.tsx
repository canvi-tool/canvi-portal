'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DataTable, type DataTableColumn } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { COMPENSATION_RULE_TYPE_LABELS } from '@/lib/constants'
import { ASSIGNMENT_STATUS_LABELS } from '@/lib/validations/assignment'
import type { ProjectAssignment } from '@/hooks/use-projects'
import { Trash2, Settings } from 'lucide-react'

interface AssignmentTableProps {
  assignments: ProjectAssignment[]
  projectId: string
  loading?: boolean
  onDelete?: (assignmentId: string) => void
  isDeleting?: boolean
}

const ASSIGNMENT_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  proposed: 'outline',
  active: 'default',
  ended: 'secondary',
  // 旧DB値互換
  confirmed: 'default',
  in_progress: 'default',
  completed: 'secondary',
  cancelled: 'secondary',
}

export function AssignmentTable({
  assignments,
  projectId,
  loading = false,
  onDelete,
  isDeleting = false,
}: AssignmentTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const columns: DataTableColumn<ProjectAssignment>[] = [
    {
      key: 'staff_name',
      header: 'スタッフ名',
      accessor: (row) => row.staff ? `${row.staff.last_name} ${row.staff.first_name}` : '(不明)',
      cell: (row) => (
        <span className="font-medium">{row.staff ? `${row.staff.last_name} ${row.staff.first_name}` : '(不明)'}</span>
      ),
    },
    {
      key: 'role_title',
      header: '役割',
      accessor: (row) => row.role_title ?? '',
      cell: (row) => row.role_title || <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'status',
      header: 'ステータス',
      accessor: (row) => row.status,
      cell: (row) => (
        <StatusBadge
          status={row.status}
          labels={ASSIGNMENT_STATUS_LABELS}
          variants={ASSIGNMENT_STATUS_VARIANTS}
        />
      ),
    },
    {
      key: 'period',
      header: '期間',
      accessor: (row) => row.start_date,
      cell: (row) => (
        <span className="text-sm">
          {row.start_date}
          {row.end_date ? ` ~ ${row.end_date}` : ' ~'}
        </span>
      ),
    },
    {
      key: 'compensation_rules',
      header: '報酬ルール',
      accessor: (row) => row.compensation_rules?.length ?? 0,
      sortable: false,
      cell: (row) => {
        const rules = row.compensation_rules || []
        if (rules.length === 0) {
          return <span className="text-muted-foreground text-xs">未設定</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {rules.slice(0, 3).map((rule) => (
              <Badge key={rule.id} variant="outline" className="text-xs">
                {COMPENSATION_RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}
              </Badge>
            ))}
            {rules.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{rules.length - 3}
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      accessor: () => null,
      sortable: false,
      className: 'w-24',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Link href={`/projects/${projectId}/assignments?highlight=${row.id}`}>
            <Button variant="ghost" size="icon-sm" title="報酬ルール設定">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="削除"
              onClick={() => setDeleteTarget(row.id)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={assignments}
        loading={loading}
        emptyMessage="アサインされたスタッフはいません"
        keyExtractor={(row) => row.id}
        pageSize={20}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="アサインの削除"
        description="このスタッフのアサインを削除しますか？関連する報酬ルールも削除されます。"
        confirmLabel="削除する"
        destructive
        onConfirm={() => {
          if (deleteTarget && onDelete) {
            onDelete(deleteTarget)
            setDeleteTarget(null)
          }
        }}
      />
    </>
  )
}
