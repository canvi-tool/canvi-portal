/**
 * 支払通知書 詳細編集
 * - ヘッダ情報 (件名/宛名/支払予定日/備考) を編集
 * - 明細はリードオンリー表示
 * - PDFダウンロード / 送信
 */
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface NoticeLine {
  id: string
  description: string
  quantity: number
  unit_label: string
  unit_price: number | null
  amount: number
  is_taxable: boolean
  formula_text: string | null
  sort_order: number
}

interface NoticeDetail {
  id: string
  notice_number: string | null
  subject: string | null
  recipient_name: string | null
  recipient_honorific: '様' | '御中' | null
  issue_date: string | null
  payment_due_date: string | null
  payment_method: string | null
  notes: string | null
  notice_status: string | null
  total_amount: number | null
  taxable_amount_10: number | null
  tax_amount_10: number | null
  non_taxable_amount: number | null
  transportation_amount: number | null
  allowance_amount: number | null
  lines: NoticeLine[]
}

export default function PaymentNoticeDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [notice, setNotice] = useState<NoticeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/payment-notices/${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setNotice(json)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '取得失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSave() {
    if (!notice) return
    setSaving(true)
    try {
      const res = await fetch(`/api/payment-notices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: notice.subject ?? undefined,
          recipient_name: notice.recipient_name ?? undefined,
          recipient_honorific: notice.recipient_honorific ?? undefined,
          payment_due_date: notice.payment_due_date ?? undefined,
          payment_method: notice.payment_method ?? undefined,
          notes: notice.notes ?? undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('保存しました')
      setNotice(json)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失敗')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('取消（論理削除）してよろしいですか？')) return
    try {
      const res = await fetch(`/api/payment-notices/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('failed')
      toast.success('取消しました')
      router.push('/payments/notices')
    } catch {
      toast.error('取消失敗')
    }
  }

  if (loading) return <div className="p-6">読込中...</div>
  if (!notice) return <div className="p-6">データなし</div>

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          支払通知書 {notice.notice_number}
        </h1>
        <div className="space-x-2">
          <a
            href={`/api/payment-notices/${id}/pdf`}
            className="px-3 py-1.5 border rounded text-sm"
          >
            PDFダウンロード
          </a>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 border border-red-300 text-red-600 rounded text-sm"
          >
            取消
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm">
          件名
          <input
            value={notice.subject ?? ''}
            onChange={(e) => setNotice({ ...notice, subject: e.target.value })}
            className="w-full border rounded px-2 py-1"
          />
        </label>
        <label className="text-sm">
          受取人
          <input
            value={notice.recipient_name ?? ''}
            onChange={(e) =>
              setNotice({ ...notice, recipient_name: e.target.value })
            }
            className="w-full border rounded px-2 py-1"
          />
        </label>
        <label className="text-sm">
          敬称
          <select
            value={notice.recipient_honorific ?? '様'}
            onChange={(e) =>
              setNotice({
                ...notice,
                recipient_honorific: e.target.value as '様' | '御中',
              })
            }
            className="w-full border rounded px-2 py-1"
          >
            <option value="様">様</option>
            <option value="御中">御中</option>
          </select>
        </label>
        <label className="text-sm">
          支払予定日
          <input
            type="date"
            value={notice.payment_due_date ?? ''}
            onChange={(e) =>
              setNotice({ ...notice, payment_due_date: e.target.value })
            }
            className="w-full border rounded px-2 py-1"
          />
        </label>
        <label className="text-sm col-span-2">
          支払方法
          <input
            value={notice.payment_method ?? ''}
            onChange={(e) =>
              setNotice({ ...notice, payment_method: e.target.value })
            }
            className="w-full border rounded px-2 py-1"
          />
        </label>
        <label className="text-sm col-span-2">
          備考
          <textarea
            value={notice.notes ?? ''}
            onChange={(e) => setNotice({ ...notice, notes: e.target.value })}
            className="w-full border rounded px-2 py-1"
          />
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存'}
      </button>

      {/* 明細 */}
      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">摘要</th>
              <th className="p-2 text-right">数量</th>
              <th className="p-2 text-center">単位</th>
              <th className="p-2 text-right">単価</th>
              <th className="p-2 text-right">金額</th>
              <th className="p-2 text-center">課税</th>
            </tr>
          </thead>
          <tbody>
            {notice.lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-2">
                  {l.description}
                  {l.formula_text && (
                    <div className="text-xs text-gray-500">
                      {l.formula_text}
                    </div>
                  )}
                </td>
                <td className="p-2 text-right">{l.quantity}</td>
                <td className="p-2 text-center">{l.unit_label}</td>
                <td className="p-2 text-right">
                  {l.unit_price !== null
                    ? `¥${Number(l.unit_price).toLocaleString('ja-JP')}`
                    : '-'}
                </td>
                <td className="p-2 text-right">
                  ¥{Number(l.amount).toLocaleString('ja-JP')}
                </td>
                <td className="p-2 text-center">{l.is_taxable ? '◯' : '－'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* サマリ */}
      <div className="grid grid-cols-2 gap-4 max-w-md ml-auto">
        <div className="text-sm text-gray-600">10%対象（税抜）</div>
        <div className="text-sm text-right">
          ¥{Number(notice.taxable_amount_10 ?? 0).toLocaleString('ja-JP')}
        </div>
        <div className="text-sm text-gray-600">消費税(10%)</div>
        <div className="text-sm text-right">
          ¥{Number(notice.tax_amount_10 ?? 0).toLocaleString('ja-JP')}
        </div>
        <div className="text-sm text-gray-600">0%対象</div>
        <div className="text-sm text-right">
          ¥{Number(notice.non_taxable_amount ?? 0).toLocaleString('ja-JP')}
        </div>
        <div className="text-base font-bold border-t pt-2">合計</div>
        <div className="text-base font-bold text-right border-t pt-2">
          ¥{Number(notice.total_amount ?? 0).toLocaleString('ja-JP')}
        </div>
      </div>
    </div>
  )
}
