'use client'

import { useState } from 'react'
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
import { StaffStatusBadge } from './staff-status-badge'
import { ApproveStaffCard } from './approve-staff-card'
import { IdentityDocumentCard } from './identity-document-card'
import { Pencil, MoreVertical, UserMinus, RefreshCw, Send, Loader2 } from 'lucide-react'
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
  const [sendingInfoUpdate, setSendingInfoUpdate] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmMissingFields, setConfirmMissingFields] = useState<string[]>([])

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

  async function handleRequestInfoUpdateCheck() {
    setSendingInfoUpdate(true)
    try {
      // まず不足フィールドをチェック
      const checkRes = await fetch(`/api/staff/${staff.id}/request-info-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ check_only: true }),
      })
      if (!checkRes.ok) {
        const err = await checkRes.json()
        toast.error(err.error || '確認に失敗しました')
        setSendingInfoUpdate(false)
        return
      }
      const checkData = await checkRes.json()
      setConfirmMissingFields(checkData.missing_fields || [])
      setConfirmDialogOpen(true)
      setSendingInfoUpdate(false)
    } catch {
      toast.error('確認に失敗しました')
      setSendingInfoUpdate(false)
    }
  }

  async function handleRequestInfoUpdateSend() {
    setConfirmDialogOpen(false)
    setSendingInfoUpdate(true)
    try {
      const res = await fetch(`/api/staff/${staff.id}/request-info-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '情報更新依頼の送信に失敗しました')
        return
      }
      if (data.email_sent) {
        toast.success('情報更新フォームのURLをメールで送信しました', {
          description: `送信先: ${data.send_to}`,
          duration: 6000,
        })
      } else {
        toast.warning('メール送信に失敗しましたが、URLは生成されました', {
          description: data.info_update_url,
          duration: 10000,
        })
      }
      router.refresh()
    } catch {
      toast.error('情報更新依頼の送信に失敗しました')
    } finally {
      setSendingInfoUpdate(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${staff.last_name} ${staff.first_name}`}
        description={`${EMPLOYMENT_TYPE_LABELS[staff.employment_type] ?? staff.employment_type} / ${staff.staff_code || '-'}`}
        actions={
          <div className="flex items-center gap-2">
            <StaffStatusBadge status={staff.status} customFields={staff.custom_fields as Record<string, unknown> | null} />
            <Button variant="outline" render={<Link href={`/staff/${staff.id}/edit`} />}>
              <Pencil className="h-4 w-4 mr-2" />
              編集
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<button className="inline-flex items-center justify-center size-8 rounded-lg border border-input bg-background hover:bg-muted transition-colors" />}
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRequestInfoUpdateCheck} disabled={sendingInfoUpdate}>
                  {sendingInfoUpdate ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  情報更新依頼を送信
                </DropdownMenuItem>
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

      {/* 承認待ちバナー */}
      <ApproveStaffCard staff={staff} />

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
                {staff.personal_email && <InfoRow label="個人メール" value={staff.personal_email} />}
                <InfoRow label="電話番号" value={staff.phone} />
                <InfoRow label="生年月日" value={staff.date_of_birth} />
                <InfoRow label="性別" value={staff.gender === 'male' ? '男性' : staff.gender === 'female' ? '女性' : staff.gender || null} />
                <InfoRow label="郵便番号" value={staff.postal_code} />
                <InfoRow label="都道府県" value={staff.prefecture} />
                <InfoRow label="住所" value={[staff.city, staff.address_line1, staff.address_line2].filter(Boolean).join(' ') || null} />
                <InfoRow label="入職日" value={staff.hire_date} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>銀行口座</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="銀行名" value={staff.bank_name} />
                <InfoRow label="支店名" value={staff.bank_branch} />
                <InfoRow label="口座種別" value={staff.bank_account_type} />
                <InfoRow label="口座番号" value={staff.bank_account_number} />
                <InfoRow label="口座名義" value={staff.bank_account_holder} />
              </CardContent>
            </Card>

            {(staff.emergency_contact_name || staff.emergency_contact_phone) && (
              <Card>
                <CardHeader>
                  <CardTitle>緊急連絡先</CardTitle>
                </CardHeader>
                <CardContent>
                  <InfoRow label="氏名" value={staff.emergency_contact_name} />
                  <InfoRow label="電話番号" value={staff.emergency_contact_phone} />
                  <InfoRow label="続柄" value={staff.emergency_contact_relationship} />
                </CardContent>
              </Card>
            )}

            {/* 本人確認書類 */}
            <IdentityDocumentCard staffId={staff.id} customFields={staff.custom_fields as Record<string, unknown> | null} />

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
                          {a.role_title && <span className="mr-2">{a.role_title}</span>}
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

      {/* 情報更新依頼 確認ダイアログ */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmMissingFields.length === 0 ? '情報更新依頼の確認' : '未入力項目があります'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMissingFields.length === 0
                ? '必須項目は全て入力済みです。それでも情報更新依頼を送信しますか？'
                : '情報更新依頼を送信しますか？'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmMissingFields.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <p className="text-xs font-medium text-amber-700 mb-1.5">未入力の必須項目（{confirmMissingFields.length}件）:</p>
              <p className="text-xs text-amber-600">{confirmMissingFields.join('、')}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleRequestInfoUpdateSend}>
              送信する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
