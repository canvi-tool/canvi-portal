'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, FolderKanban } from 'lucide-react'
import type { Tables } from '@/lib/types/database'

type Staff = Tables<'staff'>

interface Project {
  id: string
  project_code: string
  name: string
  status: string
}

interface Assignment {
  id: string
  project_id: string
  status: string
}

interface ProjectAssignDialogProps {
  staff: Staff | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ProjectAssignDialog({
  staff,
  open,
  onOpenChange,
  onSuccess,
}: ProjectAssignDialogProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [existingAssignments, setExistingAssignments] = useState<Assignment[]>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')

  // プロジェクト一覧と既存アサインを取得
  const fetchData = useCallback(async () => {
    if (!staff) return
    setLoading(true)
    try {
      const [projRes, staffRes] = await Promise.all([
        fetch('/api/projects?per_page=200'),
        fetch(`/api/staff/${staff.id}`),
      ])
      const projData = await projRes.json()
      const staffData = await staffRes.json()

      // Projects APIは配列を直接返す
      const allProjects = Array.isArray(projData) ? projData : (projData.data || [])
      const activeProjects = allProjects.filter(
        (p: Project) => p.status === 'active' || p.status === 'proposing'
      )

      // 既存アサイン（project_assignmentsフィールド、削除済み除く）
      const assignments = (staffData.project_assignments || []).filter(
        (a: Assignment & { deleted_at?: string }) =>
          !a.deleted_at && ['proposed', 'confirmed', 'in_progress', 'active'].includes(a.status)
      )
      setExistingAssignments(assignments)

      // 既存アサインのプロジェクトIDセット
      const existingIds = new Set<string>(assignments.map((a: Assignment) => a.project_id))

      // 選択状態をクリア（追加モードなので初期は空）
      setSelectedProjectIds(new Set())

      // 既存アサイン済みプロジェクトを非表示（未アサインのみ表示）
      const unassignedProjects = activeProjects.filter(
        (p: Project) => !existingIds.has(p.id)
      )
      setProjects(unassignedProjects)
    } catch {
      console.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [staff])

  useEffect(() => {
    if (staff && open) {
      setFilter('')
      fetchData()
    }
  }, [staff, open, fetchData])

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!staff) return
    setSaving(true)

    try {
      const toAdd = [...selectedProjectIds]
      const today = new Date().toISOString().split('T')[0]

      for (const projectId of toAdd) {
        const res = await fetch(`/api/projects/${projectId}/assignments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: staff.id,
            status: 'active',
            start_date: today,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          const proj = projects.find((p) => p.id === projectId)
          toast.error(`${proj?.name || projectId}: ${data.error || 'アサイン失敗'}`)
        }
        await new Promise((r) => setTimeout(r, 200))
      }

      if (toAdd.length > 0) {
        toast.success(`${toAdd.length}件のプロジェクトにアサインしました`)
      } else {
        toast.info('プロジェクトが選択されていません')
      }

      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.project_code.toLowerCase().includes(filter.toLowerCase())
  )

  const hasChanges = selectedProjectIds.size > 0

  if (!staff) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            プロジェクトアサイン
          </DialogTitle>
          <DialogDescription>
            {staff.last_name} {staff.first_name} のプロジェクトアサインを管理
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Input
            placeholder="プロジェクト名・コードで検索..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 text-sm"
          />

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">読み込み中...</span>
            </div>
          ) : (
            <ScrollArea className="h-[300px] rounded-md border">
              <div className="p-2 space-y-1">
                {filteredProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {projects.length === 0
                      ? 'アサイン可能なプロジェクトがありません'
                      : 'プロジェクトが見つかりません'}
                  </p>
                ) : (
                  filteredProjects.map((proj) => {
                    const isSelected = selectedProjectIds.has(proj.id)

                    return (
                      <label
                        key={proj.id}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-sm transition-colors ${
                          isSelected
                            ? 'bg-emerald-50 hover:bg-emerald-100'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleProject(proj.id)}
                        />
                        <FolderKanban className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="font-mono text-xs text-muted-foreground w-[70px] flex-shrink-0">
                          {proj.project_code}
                        </span>
                        <span className="truncate">{proj.name}</span>
                        {isSelected && (
                          <Badge variant="outline" className="ml-auto text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 px-1">
                            追加
                          </Badge>
                        )}
                      </label>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          )}

          <p className="text-xs text-muted-foreground">
            既存アサイン: {existingAssignments.length}件
            {hasChanges && (
              <span className="ml-1 text-emerald-600">
                ＋{selectedProjectIds.size}件追加予定
              </span>
            )}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                保存中...
              </>
            ) : (
              '保存'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
