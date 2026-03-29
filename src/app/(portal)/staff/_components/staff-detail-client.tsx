'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StaffStatusBadge } from './staff-status-badge'
import { Pencil, MoreVertical, UserMinus, RefreshCw } from 'lucide-react'
import {
  EMPLOYMENT_TYPE_LABELS,
  CONTRACT_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  REPORT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/lib/constants'
import { StatusBadge } from '@/components/shared/status-badge'
import type { Tables } from '@/lib/types/database'

type Staff = Tables<'staff'>
type Contract = Tables<'contracts'>
type WorkReport = Tables<'work_reports'>
type PaymentCalc = Tables<'payment_calculations'>

interface Assignment extends Tables<'project_assignments'> {
  project: Tables<'projects'> | null
}

interface CustomFields {
  staff_code?: string
  last_name?: string
  first_name?: string
  last_name_kana?: string
  first_name_kana?: string
  address?: string
  bank_name?: string
  bank_branch?: string
  bank_account_type?: string
  bank_account_number?: string
  bank_account_holder?: string
  [key: string]: unknown
}

interface StaffDetailClientProps {
  staff: Staff
  contracts: Contract[]
  assignments: Assignment[]
  workReports: WorkReport[]
  payments: PaymentCalc[]
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-sm">{value || '-'}</span>
    </div>
  )
}

export function StaffDetailClient({
  staff,
  contracts,
  assignments,
  workReports,
  payments,
}: StaffDetailClientProps) {
  const router = useRouter()
  const custom = (staff.custom_fields as CustomFields) || {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function handleStatusChange(_newStatus: string) {
    try {
      const res = await fetch(`/api/staff/${staff.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_code: staff.staff_code || '',
          employment_type: staff.employment_type,
          last_name: staff.last_name || '',
          first_name: staff.first_name || '',
          last_name_kana: staff.last_name_kana || '',
          first_name_kana: staff.first_name_kana || '',
          email: staff.email,
          phone: staff.phone || '',
          date_of_birth: staff.date_of_birth || '',
          address: custom.address || '',
          bank_name: custom.bank_name || '',
          bank_branch: custom.bank_branch || '',
          bank_account_type: custom.bank_account_type || '',
          bank_account_number: custom.bank_account_number || '',
          bank_account_holder: custom.bank_account_holder || '',
          hire_date: staff.hire_date || '',
          notes: staff.notes || '',
        }),
      })
      if (!res.ok) throw new Error('ステータス変更に失敗しました')
      toast.success('ステータスを変更しました')
      router.refresh()
    } catch {
      toast.error('ステータス変更に失敗しました')
    }
  }

  async function handleRetirement() {
    try {
      const res = await fetch(`/api/staff/${staff.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('退職手続きに失敗しました')
      toast.success('退職手続きを行いました')
      router.refresh()
    } catch {
      toast.error('退職手続きに失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${staff.last_name} ${staff.first_name}`}
        description={`${EMPLOYMENT_TYPE_LABELS[staff.employment_type] ?? staff.employment_type} / ${staff.staff_code || '-'}`}
        actions={
          <div className="flex items-center gap-2">
            <StaffStatusBadge status={staff.status} />
            <Button variant="outline" render={<Link href={`/staff/${staff.id}/edit`} />}>
              <Pencil className="h-4 w-4 mr-2" />
              編集
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" />}
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleStatusChange('active')}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  ステータス変更（稼働中）
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange('on_leave')}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  ステータス変更（休止中）
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleRetirement}
                  className="text-destructive focus:text-destructive"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  退職手続き
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic">基本情報</TabsTrigger>
          <TabsTrigger value="contracts">契約</TabsTrigger>
          <TabsTrigger value="assignments">PJアサイン</TabsTrigger>
          <TabsTrigger value="work_reports">勤務報告</TabsTrigger>
          <TabsTrigger value="payments">支払履歴</TabsTrigger>
        </TabsList>

        {/* 基本情報 */}
        <TabsContent value="basic">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>個人情報</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="スタッフコード" value={staff.staff_code} />
                <InfoRow label="氏名" value={`${staff.last_name} ${staff.first_name}`} />
                <InfoRow label="氏名（カナ）" value={`${staff.last_name_kana || ''} ${staff.first_name_kana || ''}`.trim() || null} />
                <InfoRow label="メール" value={staff.email} />
                <InfoRow label="電話番号" value={staff.phone} />
                <InfoRow label="生年月日" value={staff.date_of_birth} />
                <InfoRow label="住所" value={custom.address} />
                <InfoRow label="入職日" value={staff.hire_date} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>銀行口座</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="銀行名" value={custom.bank_name} />
                <InfoRow label="支店名" value={custom.bank_branch} />
                <InfoRow label="口座種別" value={custom.bank_account_type} />
                <InfoRow label="口座番号" value={custom.bank_account_number} />
                <InfoRow label="口座名義" value={custom.bank_account_holder} />
              </CardContent>
            </Card>

            {staff.notes && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>備考</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{staff.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* 契約 */}
        <TabsContent value="contracts">
          <Card>
            <CardHeader>
              <CardTitle>契約一覧</CardTitle>
            </CardHeader>
            <CardContent>
              {contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  契約がありません
                </p>
              ) : (
                <div className="space-y-3">
                  {contracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="text-sm font-medium">{contract.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {contract.start_date}
                          {contract.end_date ? ` ~ ${contract.end_date}` : ' ~'}
                        </p>
                      </div>
                      <StatusBadge
                        status={contract.status}
                        labels={CONTRACT_STATUS_LABELS}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PJアサイン */}
        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>プロジェクトアサイン</CardTitle>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  プロジェクトアサインがありません
                </p>
              ) : (
                <div className="space-y-3">
                  {assignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {a.project?.name || '不明なプロジェクト'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {a.role && <span className="mr-2">{a.role}</span>}
                          {a.start_date}
                          {a.end_date ? ` ~ ${a.end_date}` : ' ~'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.project && (
                          <StatusBadge
                            status={a.project.status}
                            labels={PROJECT_STATUS_LABELS}
                          />
                        )}
                        <Badge variant="outline">{a.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 勤務報告 */}
        <TabsContent value="work_reports">
          <Card>
            <CardHeader>
              <CardTitle>勤務報告</CardTitle>
            </CardHeader>
            <CardContent>
              {workReports.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  勤務報告がありません
                </p>
              ) : (
                <div className="space-y-3">
                  {workReports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="text-sm font-medium">{report.year_month}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          稼働日: {report.working_days}日 /
                          合計: {report.total_hours}h /
                          残業: {report.overtime_hours}h
                        </p>
                      </div>
                      <StatusBadge
                        status={report.status}
                        labels={REPORT_STATUS_LABELS}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 支払履歴 */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>支払履歴</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  支払履歴がありません
                </p>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="text-sm font-medium">{payment.year_month}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          合計金額: {`\u00A5${payment.total_amount.toLocaleString('ja-JP')}`}
                        </p>
                      </div>
                      <StatusBadge
                        status={payment.status}
                        labels={PAYMENT_STATUS_LABELS}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
