'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'
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
import { useProjects, useStaffList } from '@/hooks/use-projects'
import { REPORT_STATUS_LABELS } from '@/lib/constants'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  submitted: 'secondary',
  approved: 'default',
  rejected: 'destructive',
}

export default function PerformanceReportsPage() {
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

  // Summary stats
  const summary = useMemo(() => {
    const totalCalls = reports.reduce((sum, r) => sum + (r.call_count || 0), 0)
    const totalAppts = reports.reduce((sum, r) => sum + (r.appointment_count || 0), 0)
    const avgConversion =
      totalCalls > 0 ? Math.round((totalAppts / totalCalls) * 100 * 10) / 10 : 0
    return { totalCalls, totalAppts, avgConversion, reportCount: reports.length }
  }, [reports])

  const handleGenerate = async () => {
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
      })
      toast.success('月次実績レポートを生成しました')
      setShowGenerateDialog(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="業務実績"
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
          <Select value={filterStaff} onValueChange={setFilterStaff}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="全スタッフ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全スタッフ</SelectItem>
              {staffList.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">プロジェクト</Label>
          <Select value={filterProject} onValueChange={setFilterProject}>
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
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => {
                const conversion =
                  report.call_count > 0
                    ? Math.round(
                        (report.appointment_count / report.call_count) * 100 * 10
                      ) / 10
                    : 0

                return (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      {report.year_month}
                    </TableCell>
                    <TableCell>
                      {(report.staff as { full_name?: string } | null)?.full_name || '不明'}
                    </TableCell>
                    <TableCell>
                      {(report.project as { name?: string } | null)?.name || '未設定'}
                    </TableCell>
                    <TableCell className="text-right">
                      {report.call_count.toLocaleString('ja-JP')}
                    </TableCell>
                    <TableCell className="text-right">
                      {report.appointment_count.toLocaleString('ja-JP')}
                    </TableCell>
                    <TableCell className="text-right">{conversion}%</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[report.status] || 'outline'}>
                        {REPORT_STATUS_LABELS[report.status] || report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/reports/performance/${report.id}`}>
                        <Button variant="ghost" size="sm">
                          <FileText className="h-4 w-4 mr-1" />
                          詳細
                        </Button>
                      </Link>
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
              <Select value={genStaffId} onValueChange={setGenStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="スタッフを選択" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>プロジェクト（任意）</Label>
              <Select value={genProjectId} onValueChange={setGenProjectId}>
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
                onClick={handleGenerate}
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
