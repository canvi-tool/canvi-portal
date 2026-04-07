/**
 * 支払通知書 一覧 / 生成 / プレビュー / 送信 UI
 *
 * - 月次フィルタ + 状態フィルタ
 * - 新規生成フォーム (PJ × スタッフ × 期間)
 * - 行ごとに PDFダウンロード / メール送信
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

interface NoticeRow {
  id: string
  notice_number: string | null
  subject: string | null
  recipient_name: string | null
  total_amount: number | null
  notice_status: string | null
  sent_at: string | null
  paid_at: string | null
  year_month: string | null
  project: { id: string; name: string } | null
  staff: { id: string; last_name: string; first_name: string } | null
}

export default function PaymentNoticesPage() {
  const [items, setItems] = useState<NoticeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [yearMonth, setYearMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )
  const [status, setStatus] = useState<string>('all')

  // 生成フォーム
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    staff_id: '',
    user_id: '',
    project_id: '',
    period_start: '',
    period_end: '',
    allowance_amount: 0,
    adjustment_amount: 0,
    adjustment_note: '',
    notes: '',
  })
  const [generating, setGenerating] = useState(false)

  async function fetchList() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (yearMonth) params.set('yearMonth', yearMonth)
      if (status) params.set('status', status)
      const res = await fetch(`/api/payment-notices?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'load failed')
      setItems(json.items ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '一覧取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth, status])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setGenerating(true)
    try {
      const res = await fetch('/api/payment-notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'failed')
      toast.success('支払通知書を生成しました')
      setShowForm(false)
      fetchList()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSend(id: string) {
    if (!confirm('invoice@canvi.co.jp に送信しますか？')) return
    try {
      const res = await fetch(`/api/payment-notices/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'failed')
      toast.success('送信しました')
      fetchList()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '送信に失敗しました')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">支払通知書</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          {showForm ? 'フォームを閉じる' : '新規生成'}
        </button>
      </div>

      {/* フィルタ */}
      <div className="flex gap-3 items-center">
        <input
          type="month"
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          className="border rounded px-3 py-1.5"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded px-3 py-1.5"
        >
          <option value="all">すべて</option>
          <option value="draft">下書き</option>
          <option value="calculated">計算済</option>
          <option value="confirmed">確定</option>
          <option value="sent">送付済</option>
          <option value="paid">支払済</option>
          <option value="cancelled">取消</option>
        </select>
      </div>

      {/* 生成フォーム */}
      {showForm && (
        <form
          onSubmit={handleGenerate}
          className="border rounded p-4 bg-gray-50 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              プロジェクトID
              <input
                required
                value={form.project_id}
                onChange={(e) =>
                  setForm({ ...form, project_id: e.target.value })
                }
                className="w-full border rounded px-2 py-1"
              />
            </label>
            <label className="text-sm">
              スタッフID
              <input
                required
                value={form.staff_id}
                onChange={(e) =>
                  setForm({ ...form, staff_id: e.target.value })
                }
                className="w-full border rounded px-2 py-1"
              />
            </label>
            <label className="text-sm">
              ユーザID (users.id)
              <input
                required
                value={form.user_id}
                onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                className="w-full border rounded px-2 py-1"
              />
            </label>
            <div />
            <label className="text-sm">
              期間開始
              <input
                type="date"
                required
                value={form.period_start}
                onChange={(e) =>
                  setForm({ ...form, period_start: e.target.value })
                }
                className="w-full border rounded px-2 py-1"
              />
            </label>
            <label className="text-sm">
              期間終了
              <input
                type="date"
                required
                value={form.period_end}
                onChange={(e) =>
                  setForm({ ...form, period_end: e.target.value })
                }
                className="w-full border rounded px-2 py-1"
              />
            </label>
            <label className="text-sm">
              諸手当
              <input
                type="number"
                value={form.allowance_amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    allowance_amount: Number(e.target.value),
                  })
                }
                className="w-full border rounded px-2 py-1"
              />
            </label>
            <label className="text-sm">
              調整金 (マイナス可)
              <input
                type="number"
                value={form.adjustment_amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    adjustment_amount: Number(e.target.value),
                  })
                }
                className="w-full border rounded px-2 py-1"
              />
            </label>
            <label className="text-sm col-span-2">
              調整理由
              <input
                value={form.adjustment_note}
                onChange={(e) =>
                  setForm({ ...form, adjustment_note: e.target.value })
                }
                className="w-full border rounded px-2 py-1"
              />
            </label>
            <label className="text-sm col-span-2">
              備考
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border rounded px-2 py-1"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={generating}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
          >
            {generating ? '生成中...' : '計算 + 生成'}
          </button>
        </form>
      )}

      {/* 一覧 */}
      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">番号</th>
              <th className="p-2 text-left">PJ</th>
              <th className="p-2 text-left">受取人</th>
              <th className="p-2 text-left">件名</th>
              <th className="p-2 text-right">金額</th>
              <th className="p-2 text-center">状態</th>
              <th className="p-2 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  読込中...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  該当データなし
                </td>
              </tr>
            )}
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="p-2 font-mono text-xs">{it.notice_number}</td>
                <td className="p-2">{it.project?.name ?? '-'}</td>
                <td className="p-2">
                  {it.staff
                    ? `${it.staff.last_name} ${it.staff.first_name}`
                    : it.recipient_name}
                </td>
                <td className="p-2">{it.subject}</td>
                <td className="p-2 text-right">
                  ¥{Number(it.total_amount ?? 0).toLocaleString('ja-JP')}
                </td>
                <td className="p-2 text-center">
                  <span className="px-2 py-0.5 rounded bg-gray-200 text-xs">
                    {it.notice_status}
                  </span>
                </td>
                <td className="p-2 text-center space-x-2 whitespace-nowrap">
                  <Link
                    href={`/payments/notices/${it.id}`}
                    className="text-indigo-600 underline text-xs"
                  >
                    詳細
                  </Link>
                  <a
                    href={`/api/payment-notices/${it.id}/pdf`}
                    className="text-indigo-600 underline text-xs"
                  >
                    PDF
                  </a>
                  <button
                    onClick={() => handleSend(it.id)}
                    className="text-indigo-600 underline text-xs"
                  >
                    送信
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
