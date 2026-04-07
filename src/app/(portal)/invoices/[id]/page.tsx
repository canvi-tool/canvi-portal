'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/status-badge'

const STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  issued: '発行済',
  sent: '送付済',
  paid: '入金済',
  overdue: '支払遅延',
  cancelled: 'キャンセル',
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number | null
  amount: number
  sort_order: number
}

interface InvoicePayment {
  id: string
  paid_at: string
  amount: number
  method: string | null
  bank_transfer_ref: string | null
}

interface InvoiceDetail {
  id: string
  invoice_number: string
  status: string
  issue_date: string
  due_date: string
  period_start: string
  period_end: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  paid_amount: number
  notes: string | null
  sent_to_email: string | null
  project: { id: string; name: string } | null
  client: { id: string; name: string; email: string | null } | null
  items: InvoiceItem[]
  payments: InvoicePayment[]
}

const formatCurrency = (v: number) => `¥${Number(v ?? 0).toLocaleString('ja-JP')}`

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    paid_at: new Date().toISOString().slice(0, 10),
    amount: '',
    bank_transfer_ref: '',
  })
  const [sendEmail, setSendEmail] = useState('')

  async function fetchInvoice() {
    setLoading(true)
    try {
      const res = await fetch(`/api/invoices/${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setInvoice(json.data)
      setSendEmail(json.data?.sent_to_email ?? json.data?.client?.email ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSend() {
    if (!sendEmail) return alert('送付先メールを入力してください')
    if (!confirm(`${sendEmail} に請求書を送付しますか？`)) return
    try {
      const res = await fetch(`/api/invoices/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_email: sendEmail }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      await fetchInvoice()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'unknown')
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch(`/api/invoices/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paid_at: paymentForm.paid_at,
          amount: Number(paymentForm.amount),
          bank_transfer_ref: paymentForm.bank_transfer_ref || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setPaymentForm({ ...paymentForm, amount: '', bank_transfer_ref: '' })
      await fetchInvoice()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'unknown')
    }
  }

  async function handleCancel() {
    if (!confirm('この請求書をキャンセル（論理削除）しますか？')) return
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      window.location.href = '/invoices'
    } catch (e) {
      alert(e instanceof Error ? e.message : 'unknown')
    }
  }

  if (loading) return <p className="p-6">読み込み中...</p>
  if (error) return <p className="p-6 text-destructive">{error}</p>
  if (!invoice) return <p className="p-6">請求書が見つかりません</p>

  return (
    <div className="space-y-6">
      <PageHeader
        title={`請求書 ${invoice.invoice_number}`}
        description={`${invoice.project?.name ?? ''} / ${invoice.client?.name ?? ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/api/invoices/${id}/pdf`}
              target="_blank"
              className={buttonVariants({ variant: 'outline' })}
            >
              PDFプレビュー
            </Link>
            <Button variant="outline" onClick={handleCancel}>
              キャンセル
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">ステータス</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={invoice.status} labels={STATUS_LABELS} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">請求金額（税込）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold">
              {formatCurrency(invoice.total_amount)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">入金済</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold">
              {formatCurrency(invoice.paid_amount)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>明細</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left">
                <th className="py-2">摘要</th>
                <th className="text-right">数量</th>
                <th className="text-right">単価</th>
                <th className="text-right">金額</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items
                ?.slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((it) => (
                  <tr key={it.id} className="border-b">
                    <td className="py-2">{it.description}</td>
                    <td className="text-right">{it.quantity}</td>
                    <td className="text-right font-mono">
                      {it.unit_price != null ? formatCurrency(it.unit_price) : '-'}
                    </td>
                    <td className="text-right font-mono">{formatCurrency(it.amount)}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="py-2 text-right">
                  小計
                </td>
                <td className="text-right font-mono">
                  {formatCurrency(invoice.subtotal)}
                </td>
              </tr>
              {invoice.discount_amount > 0 && (
                <tr>
                  <td colSpan={3} className="text-right">
                    値引
                  </td>
                  <td className="text-right font-mono">
                    -{formatCurrency(invoice.discount_amount)}
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={3} className="text-right">
                  消費税(10%)
                </td>
                <td className="text-right font-mono">
                  {formatCurrency(invoice.tax_amount)}
                </td>
              </tr>
              <tr className="font-bold border-t">
                <td colSpan={3} className="py-2 text-right">
                  合計
                </td>
                <td className="text-right font-mono">
                  {formatCurrency(invoice.total_amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>送付</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 items-center">
          <Input
            type="email"
            value={sendEmail}
            onChange={(e) => setSendEmail(e.target.value)}
            placeholder="送付先メールアドレス"
            className="max-w-sm"
          />
          <Button onClick={handleSend}>メール送付</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>入金記録</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={handleRecordPayment}
            className="flex flex-wrap gap-2 items-end"
          >
            <div>
              <label className="text-xs text-muted-foreground">入金日</label>
              <Input
                type="date"
                value={paymentForm.paid_at}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, paid_at: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">入金額</label>
              <Input
                type="number"
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, amount: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">振込参照番号</label>
              <Input
                value={paymentForm.bank_transfer_ref}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    bank_transfer_ref: e.target.value,
                  })
                }
              />
            </div>
            <Button type="submit">登録</Button>
          </form>

          {invoice.payments && invoice.payments.length > 0 && (
            <table className="w-full text-sm border-t pt-2">
              <thead>
                <tr className="text-left">
                  <th>入金日</th>
                  <th className="text-right">金額</th>
                  <th>参照</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td>{p.paid_at}</td>
                    <td className="text-right font-mono">{formatCurrency(p.amount)}</td>
                    <td>{p.bank_transfer_ref ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
