'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ChevronLeft,
  Send,
  Users,
  Building2,
  Briefcase,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  FileSignature,
  UserCheck,
} from 'lucide-react'
import { useContractList } from '@/hooks/use-contracts'
import { toast } from 'sonner'

interface BulkSendResult {
  contractId: string
  staffName: string
  email: string
  status: 'success' | 'error' | 'skipped'
  message: string
}

type RecipientType = 'all' | 'employee' | 'contractor' | 'freelancer'

const RECIPIENT_TYPES: { value: RecipientType; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'すべて', description: '下書き状態のすべての契約', icon: Users },
  { value: 'employee', label: '社員', description: '雇用形態が「社員」のスタッフ', icon: Building2 },
  { value: 'contractor', label: '契約社員', description: '雇用形態が「契約社員」のスタッフ', icon: UserCheck },
  { value: 'freelancer', label: '業務委託・フリーランス', description: '業務委託・フリーランスのスタッフ', icon: Briefcase },
]

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function ContractSendPage() {
  const [recipientType, setRecipientType] = useState<RecipientType>('all')
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<BulkSendResult[] | null>(null)
  const [showResultDialog, setShowResultDialog] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data, isLoading, refetch } = useContractList({ status: 'draft' })

  // フィルタリング: 雇用形態でフィルタ
  const filteredContracts = useMemo(() => {
    if (!data?.data) return []
    if (recipientType === 'all') return data.data

    return data.data.filter((contract) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const staff = contract.staff as any
      if (!staff) return false
      return staff.employment_type === recipientType
    })
  }, [data, recipientType])

  // 送信可能な契約（メールが設定されているもの）
  const sendableContracts = useMemo(() => {
    return filteredContracts.filter((c) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const staff = c.staff as any
      return staff?.email
    })
  }, [filteredContracts])

  const handleSend = async () => {
    setConfirmOpen(false)
    if (sendableContracts.length === 0) {
      toast.error('送信対象の契約がありません')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/contracts/bulk-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractIds: sendableContracts.map((c) => c.id),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '送信に失敗しました')
      }

      const result = await res.json()
      setResults(result.results)
      setShowResultDialog(true)

      if (result.summary.success > 0) {
        toast.success(`${result.summary.success}件の署名依頼を送信しました`)
      }

      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '送信に失敗しました')
    } finally {
      setSending(false)
    }
  }

  const successCount = results?.filter((r) => r.status === 'success').length || 0
  const errorCount = results?.filter((r) => r.status === 'error').length || 0
  const skippedCount = results?.filter((r) => r.status === 'skipped').length || 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="契約一括送付"
        description="対象者を選択して契約書をfreee Signで一括送信"
        actions={
          <Button variant="outline" render={<Link href="/contracts" />}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            契約一覧に戻る
          </Button>
        }
      />

      {/* ステップ 1: 送付対象を選択 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">1</span>
            送付対象を選択
          </CardTitle>
          <CardDescription>
            契約書を送付する対象の雇用形態を選択してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {RECIPIENT_TYPES.map((type) => {
              const isSelected = recipientType === type.value
              const Icon = type.icon
              return (
                <button
                  key={type.value}
                  onClick={() => setRecipientType(type.value)}
                  className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all hover:shadow-sm ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-950/30'
                      : 'border-border hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : ''}`}>
                      {type.label}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{type.description}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ステップ 2: 送付対象プレビュー */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">2</span>
            送付対象の確認
          </CardTitle>
          <CardDescription>
            下記の契約が送信されます。メールアドレスが未設定のスタッフはスキップされます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileSignature className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">下書き状態の契約がありません</p>
              <p className="text-xs mt-1">まず契約を作成してください</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="mb-4 flex gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{filteredContracts.length}件</Badge>
                  <span className="text-sm text-muted-foreground">対象契約</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default">{sendableContracts.length}件</Badge>
                  <span className="text-sm text-muted-foreground">送信可能</span>
                </div>
                {filteredContracts.length - sendableContracts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">
                      {filteredContracts.length - sendableContracts.length}件
                    </Badge>
                    <span className="text-sm text-muted-foreground">メール未設定</span>
                  </div>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-medium">スタッフ名</th>
                      <th className="px-3 py-2 text-left font-medium">雇用形態</th>
                      <th className="px-3 py-2 text-left font-medium">メール</th>
                      <th className="px-3 py-2 text-left font-medium">タイトル</th>
                      <th className="px-3 py-2 text-left font-medium">開始日</th>
                      <th className="px-3 py-2 text-left font-medium">送信</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContracts.map((contract) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const staff = contract.staff as any
                      const hasEmail = !!staff?.email
                      const employmentLabels: Record<string, string> = {
                        employee: '社員',
                        contractor: '契約社員',
                        freelancer: '業務委託',
                      }
                      return (
                        <tr key={contract.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">{staff ? `${staff.last_name} ${staff.first_name}` : '-'}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-xs">
                              {employmentLabels[staff?.employment_type] || staff?.employment_type || '-'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {staff?.email || (
                              <span className="text-red-500 text-xs">未設定</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{contract.title}</td>
                          <td className="px-3 py-2">{formatDate(contract.start_date)}</td>
                          <td className="px-3 py-2">
                            {hasEmail ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-400" />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ステップ 3: 送信 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">3</span>
            一括送信
          </CardTitle>
          <CardDescription>
            freee Signを通じて署名依頼を一括送信します。送信後、各契約のステータスが「署名待ち」に変更されます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              size="lg"
              onClick={() => setConfirmOpen(true)}
              disabled={sendableContracts.length === 0 || sending}
            >
              {sending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  送信中...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  {sendableContracts.length}件を一括送信
                </>
              )}
            </Button>
            {sendableContracts.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground">送信対象の契約がありません</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 送信確認ダイアログ */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>一括送信の確認</DialogTitle>
            <DialogDescription>
              以下の内容で署名依頼を送信します。この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">対象</span>
                <span className="font-medium">
                  {RECIPIENT_TYPES.find((t) => t.value === recipientType)?.label}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">送信件数</span>
                <span className="font-medium">{sendableContracts.length}件</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">送信方法</span>
                <span className="font-medium">freee Sign 電子署名</span>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSend}>
              <Send className="h-4 w-4 mr-2" />
              送信実行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 送信結果ダイアログ */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>送信結果</DialogTitle>
            <DialogDescription>
              一括送信の結果を確認してください。
            </DialogDescription>
          </DialogHeader>

          {/* Summary */}
          <div className="flex gap-4 mt-2">
            {successCount > 0 && (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{successCount}件 成功</span>
              </div>
            )}
            {errorCount > 0 && (
              <div className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">{errorCount}件 失敗</span>
              </div>
            )}
            {skippedCount > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">{skippedCount}件 スキップ</span>
              </div>
            )}
          </div>

          <div className="mt-2 max-h-64 overflow-y-auto">
            {results?.map((result) => (
              <div
                key={result.contractId}
                className="flex items-start gap-3 border-b py-3 last:border-0"
              >
                <div className="mt-0.5 shrink-0">
                  {result.status === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : result.status === 'error' ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{result.staffName}</p>
                  <p className="text-xs text-muted-foreground">{result.email || 'メール未設定'}</p>
                  <p className="text-xs mt-0.5">{result.message}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowResultDialog(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
