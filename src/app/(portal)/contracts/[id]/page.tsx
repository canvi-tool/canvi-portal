'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronLeft,
  Edit,
  Download,
  Send,
  RefreshCw,
} from 'lucide-react'
import { useContract, useGenerateContractPdf, useSendContractForSigning, useUpdateContractStatus } from '@/hooks/use-contracts'
import { ContractStatusTracker, ContractStatusBadge } from '../_components/contract-status-tracker'
import { ContractPreview } from '../_components/contract-preview'
import { toast } from 'sonner'
import { useState } from 'react'
import type { ContractStatus } from '@/lib/types/enums'

const STATUS_TRANSITIONS: Record<string, { label: string; next: ContractStatus }[]> = {
  draft: [{ label: '署名依頼を送信', next: 'pending_signature' }],
  pending_signature: [
    { label: '署名完了にする', next: 'signed' },
    { label: '下書きに戻す', next: 'draft' },
  ],
  signed: [{ label: '有効にする', next: 'active' }],
  active: [
    { label: '期限切れにする', next: 'expired' },
    { label: '解約する', next: 'terminated' },
  ],
  expired: [],
  terminated: [],
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function ContractDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: contract, isLoading } = useContract(id)
  const generatePdf = useGenerateContractPdf()
  const sendForSigning = useSendContractForSigning()
  const updateStatus = useUpdateContractStatus(id)
  const [statusChangeLoading, setStatusChangeLoading] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staff = contract?.staff as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const template = contract?.template as any

  const handleDownloadPdf = async () => {
    try {
      const blob = await generatePdf.mutateAsync(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${contract?.title || '契約書'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('PDFをダウンロードしました')
    } catch {
      toast.error('PDF生成に失敗しました')
    }
  }

  const handleSendForSigning = async () => {
    try {
      await sendForSigning.mutateAsync(id)
      toast.success('署名依頼を送信しました')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '署名依頼の送信に失敗しました')
    }
  }

  const handleStatusChange = async (newStatus: ContractStatus) => {
    setStatusChangeLoading(true)
    try {
      // If changing to pending_signature, use the sign endpoint
      if (newStatus === 'pending_signature') {
        await handleSendForSigning()
      } else {
        await updateStatus.mutateAsync(newStatus)
        toast.success('ステータスを更新しました')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ステータスの更新に失敗しました')
    } finally {
      setStatusChangeLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="mb-4 text-muted-foreground">契約が見つかりません</p>
        <Button variant="outline" onClick={() => router.push('/contracts')}>
          一覧に戻る
        </Button>
      </div>
    )
  }

  const transitions = STATUS_TRANSITIONS[contract.status] || []

  return (
    <div className="space-y-6">
      <PageHeader
        title={contract.title}
        description={`契約番号: ${contract.id.slice(0, 8).toUpperCase()}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/contracts" />}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              一覧に戻る
            </Button>
            {contract.status === 'draft' && (
              <Button variant="outline" render={<Link href={`/contracts/${id}/edit`} />}>
                <Edit className="h-4 w-4 mr-2" />
                編集
              </Button>
            )}
            <Button variant="outline" onClick={handleDownloadPdf} disabled={generatePdf.isPending}>
              <Download className="h-4 w-4 mr-2" />
              {generatePdf.isPending ? 'PDF生成中...' : 'PDF生成'}
            </Button>
            {contract.status === 'draft' && (
              <Button onClick={handleSendForSigning} disabled={sendForSigning.isPending}>
                <Send className="h-4 w-4 mr-2" />
                {sendForSigning.isPending ? '送信中...' : 'freee Signで送信'}
              </Button>
            )}
          </div>
        }
      />

      {/* Status Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ステータス</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractStatusTracker
            currentStatus={contract.status as ContractStatus}
            createdAt={contract.created_at}
            signedAt={contract.signed_at}
            updatedAt={contract.updated_at}
          />

          {/* Status Change Actions */}
          {transitions.length > 0 && (
            <div className="mt-4 flex gap-2">
              {transitions.map((t) => (
                <Button
                  key={t.next}
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange(t.next)}
                  disabled={statusChangeLoading}
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  {t.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract Info */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">契約情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">ステータス</span>
              <div className="mt-1">
                <ContractStatusBadge status={contract.status as ContractStatus} />
              </div>
            </div>
            <Separator />
            <div>
              <span className="text-muted-foreground">スタッフ</span>
              <div className="mt-1 font-medium">
                {staff?.full_name || '-'}
              </div>
              {staff?.email && (
                <div className="text-xs text-muted-foreground">{staff.email}</div>
              )}
            </div>
            <Separator />
            <div>
              <span className="text-muted-foreground">テンプレート</span>
              <div className="mt-1">{template?.name || 'なし'}</div>
            </div>
            <Separator />
            <div>
              <span className="text-muted-foreground">開始日</span>
              <div className="mt-1">{formatDate(contract.start_date)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">終了日</span>
              <div className="mt-1">{formatDate(contract.end_date)}</div>
            </div>
            <Separator />
            <div>
              <span className="text-muted-foreground">署名日時</span>
              <div className="mt-1">{formatDateTime(contract.signed_at)}</div>
            </div>
            {contract.external_sign_id && (
              <div>
                <span className="text-muted-foreground">freee Sign ID</span>
                <div className="mt-1 font-mono text-xs">{contract.external_sign_id}</div>
              </div>
            )}
            <Separator />
            <div>
              <span className="text-muted-foreground">作成日時</span>
              <div className="mt-1">{formatDateTime(contract.created_at)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">更新日時</span>
              <div className="mt-1">{formatDateTime(contract.updated_at)}</div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <ContractPreview
            title={contract.title}
            content={contract.content || ''}
            staffName={staff?.full_name}
            startDate={contract.start_date}
            endDate={contract.end_date}
            contractId={contract.id}
          />
        </div>
      </div>
    </div>
  )
}
