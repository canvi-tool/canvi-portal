'use client'

import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/layout/page-header'
import {
  usePerformanceReports,
  useGeneratePerformanceReport,
} from '@/hooks/use-reports'
import { useRouter } from 'next/navigation'
import { useProjects, useStaffList } from '@/hooks/use-projects'
import { REPORT_STATUS_LABELS } from '@/lib/constants'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  submitted: 'secondary',
  approved: 'default',
  rejected: 'destructive',
}

// Helper functions to extract legacy fields from the new summary JSON structure
function getYearMonth(report: { period_start: string }): string {
  return report.period_start?.slice(0, 7) ?? ''
}
function getCallCount(report: { summary: unknown }): number {
  return (report.summary as Record<string, unknown>)?.call_count as number ?? 0
}
function getAppointmentCount(report: { summary: unknown }): number {
  return (report.summary as Record<string, unknown>)?.appointment_count as number ?? 0
}

export default function PerformanceReportsPage() {
  const router = useRouter()

  const [yearMonth, setYearMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )
  const [filterStaff, setFilterStaff] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [genStaffId, setGenStaffId] = useState('')
  const [genProjectId, setGenProjectId] = useState('')

  const { data: reports = [], isLoading } = usePerformanceReports({
    year_month: yearMonth || undefined,
    staff_id: filterStaff || undefined,
    project_id: filterProject || undefined,
  })

  const { data: projects = [] } = useProjects()
  const { data: staffList = [] } = useStaffList()
  const generateReport = useGeneratePerformanceReport()

  const staffItems = useMemo(
    () => ({ all: '全スタッフ', ...Object.fromEntries(staffList.map((s) => [s.id, `${s.last_name || ''} ${s.first_name || ''}`.trim() || s.id])) }),
    [staffList]
  )
  const staffItemsNoAll = useMemo(
    () => Object.fromEntries(staffList.map((s) => [s.id, `${s.last_name || ''} ${s.first_name || ''}`.trim() || s.id])),
    [staffList]
  )
  const projectItems = useMemo(
    () => ({ all: '全プロジェクト', ...Object.fromEntries(projects.map((p) => [p.id, p.name])) }),
    [projects]
  )

  // Summary stats
  const summary = useMemo(() => {
    const totalCalls = reports.reduce((sum, r) => sum + getCallCount(r), 0)
    const totalAppts = reports.reduce((sum, r) => sum + getAppointmentCount(r), 0)
    const avgConversion =
      totalCalls > 0 ? Math.round((totalAppts / totalCalls) * 100 * 10) / 10 : 0
    return { totalCalls, totalAppts, avgConversion, reportCount: reports.length }
  }, [reports])

  const handleGenerate = async (asDraft = false) => {
    if (!genStaffId || !yearMonth) {
      toast.error('スタッフと対象月を選択してください')
      return
    }

    try {
      await generateReport.mutateAsync({
        staff_id: genStaffId,
        project_id: genProjectId || undefined,
        year_month: yearMonth,
        call_count: 0,
        appointment_count: 0,
        asDraft,
      })
      toast.success(asDraft ? '下書きを保存しました' : '月次実績レポートを生成しました')
      setShowGenerateDialog(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="月次報告"
        description="月次の業務実績レポートを管理します"
        actions={
          <Button size="sm" onClick={() => setShowGenerateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            月次レポート生成
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">レポート数</p>
            <p className="text-2xl font-bold">{summary.reportCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">総架電件数</p>
            <p className="text-2xl font-bold">{summary.totalCalls.toLocaleString('ja-JP')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">総アポ件数</p>
            <p className="text-2xl font-bold">{summary.totalAppts.toLocaleString('ja-JP')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">平均アポ率</p>
            <p className="text-2xl font-bold">{summary.avgConversion}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs">対象月</Label>
          <Input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">スタッフ</Label>
          <Select value={filterStaff} onValueChange={setFilterStaff} items={staffItems}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="全スタッフ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全スタッフ</SelectItem>
              {staffList.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.last_name} {s.first_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">プロジェクト</Label>
          <Select value={filterProject} onValueChange={setFilterProject} items={projectItems}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="全プロジェクト" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全プロジェクト</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          読み込み中...
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          業務実績データがありません
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>対象月</TableHead>
                <TableHead>スタッフ名</TableHead>
                <TableHead>PJ名</TableHead>
                <TableHead className="text-right">架電件数</TableHead>
                <TableHead className="text-right">アポ件数</TableHead>
                <TableHead className="text-right">アポ率</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => {
                const cc = getCallCount(report)
                const ac = getAppointmentCount(report)
                const conversion =
                  cc > 0
                    ? Math.round(
                        (ac / cc) * 100 * 10
                      ) / 10
                    : 0

                return (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      {getYearMonth(report)}
                    </TableCell>
                    <TableCell>
                      {(() => { const s = report.staff as { last_name?: string; first_name?: string } | null; return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : '不明' })()}
                    </TableCell>
                    <TableCell>
                      {(report.project as { name?: string } | null)?.name || '未設定'}
                    </TableCell>
                    <TableCell className="text-right">
                      {cc.toLocaleString('ja-JP')}
                    </TableCell>
                    <TableCell className="text-right">
                      {ac.toLocaleString('ja-JP')}
                    </TableCell>
                    <TableCell className="text-right">{conversion}%</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[report.status] || 'outline'}>
                        {REPORT_STATUS_LABELS[report.status] || report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {report.status === 'approved' ? (
                          <button
                            type="button"
                            onClick={() => router.push(`/reports/performance/${report.id}`)}
                            className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            閲覧
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => router.push(`/reports/performance/${report.id}`)}
                            className="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                          >
                            修正
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Generate dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>月次レポート生成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>対象月</Label>
              <Input
                type="month"
                value={yearMonth}
                onChange={(e) => setYearMonth(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>スタッフ</Label>
              <Select value={genStaffId} onValueChange={setGenStaffId} items={staffItemsNoAll}>
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>プロジェクト（任意）</Label>
              <Select value={genProjectId} onValueChange={setGenProjectId} items={projectItems}>
                <SelectTrigger>
                  <SelectValue placeholder="全プロジェクト" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全プロジェクト</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowGenerateDialog(false)}
              >
                キャンセル
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleGenerate(true)}
                disabled={generateReport.isPending}
              >
                下書き保存
              </Button>
              <Button
                onClick={() => handleGenerate(false)}
                disabled={generateReport.isPending}
              >
                {generateReport.isPending ? '生成中...' : '生成'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
