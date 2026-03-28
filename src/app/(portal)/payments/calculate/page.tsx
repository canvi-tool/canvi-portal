'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCalculatePayments } from '@/hooks/use-payments'
import { useStaffList } from '@/hooks/use-staff'
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Loader2,
  Users,
  Wallet,
  AlertTriangle,
} from 'lucide-react'
import type { MonthlyCalculationSummary } from '@/lib/calculations/types'

/**
 * 年月選択肢
 */
function generateYearMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
    options.push({ value, label })
  }

  return options
}

export default function CalculatePage() {
  const router = useRouter()
  const yearMonthOptions = useMemo(() => generateYearMonthOptions(), [])
  const [yearMonth, setYearMonth] = useState(yearMonthOptions[0].value)
  const [result, setResult] = useState<MonthlyCalculationSummary | null>(null)

  const { data: staffData } = useStaffList({ status: 'active' })
  const calculatePayments = useCalculatePayments()

  const activeStaffCount = staffData?.data?.length ?? 0
  const [year, month] = yearMonth.split('-')
  const displayYearMonth = `${year}年${parseInt(month)}月`

  const handleCalculate = async () => {
    try {
      const res = await calculatePayments.mutateAsync(yearMonth)
      setResult(res)
      toast.success(
        `計算完了: ${res.totalStaff}名, 総額${res.totalAmount.toLocaleString('ja-JP')}円`
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '計算の実行に失敗しました'
      )
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="月次計算実行"
        description="指定した年月の支払い計算を一括で実行します"
        actions={
          <Button variant="outline" onClick={() => router.push('/payments')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            支払管理に戻る
          </Button>
        }
      />

      {/* 計算設定 */}
      <Card>
        <CardHeader>
          <CardTitle>計算設定</CardTitle>
          <CardDescription>
            対象年月を選択して計算を実行してください。既に計算済みのデータは上書きされます（確定済みを除く）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">対象年月</label>
              <div className="w-48">
                <Select value={yearMonth} onValueChange={setYearMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="年月を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearMonthOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleCalculate}
              disabled={calculatePayments.isPending}
              size="lg"
            >
              {calculatePayments.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="mr-2 h-4 w-4" />
              )}
              {calculatePayments.isPending ? '計算中...' : '計算実行'}
            </Button>
          </div>

          {/* プレビュー */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Users className="h-4 w-4" />
              <span>計算対象のプレビュー</span>
            </div>
            <p className="text-sm">
              対象月: <strong>{displayYearMonth}</strong> /
              アクティブスタッフ数: <strong>{activeStaffCount}名</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              各スタッフのアクティブなアサインメントと報酬ルールに基づいて計算されます。
              勤務報告・業務実績報告のデータが使用されます。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 計算中の進捗 */}
      {calculatePayments.isPending && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-medium">計算を実行中です...</p>
              <p className="text-sm text-muted-foreground">
                {displayYearMonth}の全スタッフの支払い計算を処理しています。
                しばらくお待ちください。
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 計算結果 */}
      {result && !calculatePayments.isPending && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle>計算結果</CardTitle>
            </div>
            <CardDescription>
              {new Date(result.calculatedAt).toLocaleString('ja-JP')} に計算完了
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* サマリーカード */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <div className="rounded-lg border p-4 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{result.totalStaff}名</p>
                <p className="text-xs text-muted-foreground">計算対象</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <Wallet className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold font-mono">
                  {result.totalAmount.toLocaleString('ja-JP')}円
                </p>
                <p className="text-xs text-muted-foreground">総支払額</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <Calculator className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">
                  {result.staffResults.reduce(
                    (sum, s) => sum + s.projects.reduce((ps, p) => ps + p.lines.length, 0),
                    0
                  )}
                  件
                </p>
                <p className="text-xs text-muted-foreground">計算ルール数</p>
              </div>
            </div>

            {/* スタッフ別結果 */}
            {result.staffResults.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">スタッフ別内訳</h3>
                <div className="rounded-lg border divide-y">
                  {result.staffResults.map((sr) => (
                    <div
                      key={sr.staffId}
                      className="flex items-center justify-between p-3"
                    >
                      <div>
                        <p className="font-medium text-sm">{sr.staffName}</p>
                        <p className="text-xs text-muted-foreground">
                          {sr.projects.length}件のPJ,{' '}
                          {sr.projects.reduce((s, p) => s + p.lines.length, 0)}
                          件のルール
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-medium">
                          {sr.totalAmount.toLocaleString('ja-JP')}円
                        </p>
                        {sr.taxAmount > 0 && (
                          <p className="text-xs text-muted-foreground">
                            (税込, 税額{sr.taxAmount.toLocaleString('ja-JP')}円)
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.totalStaff === 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    計算対象のスタッフがいません
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    アクティブなスタッフにアサインメントと報酬ルールが設定されているか確認してください。
                  </p>
                </div>
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setResult(null)}>
                もう一度計算
              </Button>
              <Button onClick={() => router.push(`/payments/${yearMonth}`)}>
                {displayYearMonth}の一覧を確認
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
