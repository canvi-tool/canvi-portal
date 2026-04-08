'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'

interface SlotData {
  start: string
  end: string
  date: string
  startTime: string
  endTime: string
}

interface ScheduleData {
  title: string
  memberNames: string[]
  mode: 'all_free' | 'any_free'
  durationMinutes: number
  slots: SlotData[]
}

export default function ScheduleBookingPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<ScheduleData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // 予約フォーム
  const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestCompany, setGuestCompany] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [booked, setBooked] = useState<{ meetUrl: string } | null>(null)

  useEffect(() => {
    fetch(`/api/scheduling/${slug}`)
      .then(r => {
        if (!r.ok) throw new Error('invalid')
        return r.json()
      })
      .then(setData)
      .catch(() => setError('このリンクは無効または期限切れです'))
      .finally(() => setLoading(false))
  }, [slug])

  // 日付ごとにグループ化
  const slotsByDate = useMemo(() => {
    if (!data) return new Map<string, SlotData[]>()
    const map = new Map<string, SlotData[]>()
    for (const s of data.slots) {
      if (!map.has(s.date)) map.set(s.date, [])
      map.get(s.date)!.push(s)
    }
    return map
  }, [data])

  const refreshSlots = async () => {
    try {
      const r = await fetch(`/api/scheduling/${slug}`)
      if (r.ok) setData(await r.json())
    } catch {}
  }

  const handleBook = async () => {
    if (!selectedSlot || !guestName || !guestEmail || !guestPhone) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/scheduling/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone,
          guest_company: guestCompany || undefined,
          selected_start: selectedSlot.start,
          selected_end: selectedSlot.end,
          message: message || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 409) {
          alert('この時間帯は他の方に予約されました。最新の空き時間を再取得します。')
          await refreshSlots()
          setSelectedSlot(null)
          return
        }
        throw new Error(err.error || '予約に失敗しました')
      }

      const result = await res.json()
      setBooked({ meetUrl: result.meetUrl || '' })
    } catch (e) {
      alert(e instanceof Error ? e.message : '予約に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDateJP = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    const days = ['日', '月', '火', '水', '木', '金', '土']
    return `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center max-w-md">
          <div className="text-4xl mb-4">📅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">リンクが無効です</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (booked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-4xl mb-3">✅</div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">予約が完了しました</h1>
            <p className="text-sm text-gray-500 mb-6">ご登録のメールアドレスに招待が届きます</p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="text-xs text-indigo-700 font-medium mb-1">予定</div>
              <div className="font-semibold text-gray-900">{data?.title}</div>
              <div className="text-gray-700 mt-1">
                {selectedSlot && (
                  <>
                    {formatDateJP(selectedSlot.date)} {selectedSlot.startTime} 〜 {selectedSlot.endTime}
                    <span className="text-gray-500 ml-1">（{data?.durationMinutes}分）</span>
                  </>
                )}
              </div>
              {data?.memberNames && data.memberNames.length > 0 && (
                <div className="text-gray-600 mt-1 text-xs">
                  担当: {data.memberNames.join('、')}
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-1">
              <div className="text-xs text-gray-500 font-medium mb-1">ご登録内容</div>
              <div><span className="text-gray-500">お名前:</span> <span className="text-gray-900">{guestName}</span></div>
              {guestCompany && <div><span className="text-gray-500">会社:</span> <span className="text-gray-900">{guestCompany}</span></div>}
              <div><span className="text-gray-500">メール:</span> <span className="text-gray-900 break-all">{guestEmail}</span></div>
              <div><span className="text-gray-500">電話:</span> <span className="text-gray-900">{guestPhone}</span></div>
            </div>

            {booked.meetUrl && (
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs font-medium text-blue-900 mb-1">Google Meet</p>
                <a
                  href={booked.meetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline break-all"
                >
                  {booked.meetUrl}
                </a>
                <p className="text-xs text-blue-700 mt-2">当日このリンクからご参加ください</p>
              </div>
            )}

            <div className="rounded-lg border border-gray-200 p-3 text-xs text-gray-600">
              カレンダー招待をメールでお送りしています。届かない場合は迷惑メールフォルダもご確認ください。
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-6 text-center">このページを閉じても問題ありません</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
              C
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{data?.title}</h1>
              <p className="text-sm text-gray-500">
                {data?.durationMinutes}分 ・ {data?.memberNames.join('、')}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {data?.mode === 'all_free'
              ? 'メンバー全員が参加可能な時間帯です'
              : 'いずれかのメンバーが参加可能な時間帯です'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {data && data.slots.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <div className="text-4xl mb-4">😔</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">空き時間が見つかりません</h2>
            <p className="text-gray-500">
              現在、選択可能な日時がありません。リンクの発行者にお問い合わせください。
            </p>
          </div>
        ) : selectedSlot ? (
          /* 予約フォーム */
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">予約情報を入力</h2>
              <button
                onClick={() => setSelectedSlot(null)}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                日時を変更
              </button>
            </div>

            <div className="bg-indigo-50 rounded-lg p-3 mb-6 text-sm">
              <span className="font-medium text-indigo-900">
                {formatDateJP(selectedSlot.date)} {selectedSlot.startTime} 〜 {selectedSlot.endTime}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="山田 太郎"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="taro@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  電話番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="090-1234-5678"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  会社名
                </label>
                <input
                  type="text"
                  value={guestCompany}
                  onChange={e => setGuestCompany(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="株式会社〇〇"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メッセージ（任意）
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="よろしくお願いいたします"
                />
              </div>

              <button
                onClick={handleBook}
                disabled={submitting || !guestName || !guestEmail || !guestPhone}
                className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? '予約中...' : '予約を確定する'}
              </button>
            </div>
          </div>
        ) : (
          /* 日時選択 */
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">日時を選択してください</h2>
            {Array.from(slotsByDate.entries()).map(([date, slots]) => (
              <div key={date} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b">
                  <h3 className="font-medium text-gray-900">{formatDateJP(date)}</h3>
                </div>
                <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((slot, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedSlot(slot)}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 px-3 py-2 text-sm font-medium hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
                    >
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-xs text-gray-400">
        Powered by Canvi Portal
      </div>
    </div>
  )
}
