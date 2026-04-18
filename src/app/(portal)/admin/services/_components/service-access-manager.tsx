'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'

type Service = {
  id: string
  slug: string
  name: string
  category: string | null
}

type StaffMember = {
  id: string
  last_name: string | null
  first_name: string | null
  email: string | null
  user_id: string | null
}

export function ServiceAccessManager({
  services,
  staff,
  accessMap,
}: {
  services: Service[]
  staff: StaffMember[]
  accessMap: Record<string, Set<string>>
}) {
  const [localAccess, setLocalAccess] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {}
    for (const [k, v] of Object.entries(accessMap)) init[k] = new Set(v)
    return init
  })
  const [search, setSearch] = useState('')
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const toggle = async (userId: string, serviceId: string) => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    const currentSet = localAccess[userId] || new Set()
    const isGranted = currentSet.has(serviceId)

    // Optimistic update
    const nextSet = new Set(currentSet)
    if (isGranted) nextSet.delete(serviceId)
    else nextSet.add(serviceId)
    setLocalAccess({ ...localAccess, [userId]: nextSet })

    startTransition(async () => {
      if (isGranted) {
        // 取り消し
        const { error } = await sb
          .from('user_service_access')
          .delete()
          .eq('user_id', userId)
          .eq('service_id', serviceId)
        if (error) {
          setMsg(`エラー: ${error.message}`)
          // rollback
          setLocalAccess({ ...localAccess })
        } else {
          setMsg('付与を取り消しました')
        }
      } else {
        // 付与
        const { error } = await sb
          .from('user_service_access')
          .insert({ user_id: userId, service_id: serviceId })
        if (error) {
          setMsg(`エラー: ${error.message}`)
          setLocalAccess({ ...localAccess })
        } else {
          setMsg('サービスを付与しました')
        }
      }
      setTimeout(() => setMsg(null), 2500)
    })
  }

  const filtered = staff.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = `${s.last_name ?? ''}${s.first_name ?? ''}`.toLowerCase()
    return name.includes(q) || (s.email ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="氏名・メールで検索"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        {pending && <span className="text-xs text-slate-500">更新中…</span>}
        {msg && (
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded">{msg}</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-medium text-slate-700 min-w-[200px]">
                ユーザー
              </th>
              {services.map((svc) => {
                const isBase = svc.slug === 'canvi-portal'
                return (
                  <th key={svc.id} className={`px-3 py-3 text-center font-medium min-w-[110px] ${isBase ? 'text-slate-400 bg-slate-50' : 'text-slate-700'}`}>
                    <div className="text-xs font-semibold flex items-center justify-center gap-1">
                      {svc.name}
                      {isBase && (
                        <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-normal" title="Canviポータルは基幹システム。ログイン可能な全ユーザーに自動付与されます">
                          基幹
                        </span>
                      )}
                    </div>
                    {svc.category && <div className="text-[10px] text-slate-400 mt-0.5">{svc.category}</div>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              if (!s.user_id) return null
              const granted = localAccess[s.user_id] || new Set()
              return (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {s.last_name ?? ''} {s.first_name ?? ''}
                    </div>
                    <div className="text-xs text-slate-500 truncate max-w-[180px]">{s.email ?? '-'}</div>
                  </td>
                  {services.map((svc) => {
                    const isOn = granted.has(svc.id)
                    const isBase = svc.slug === 'canvi-portal'
                    // 基幹サービス（Canviポータル）はトグル操作不可・常時ON表示
                    if (isBase) {
                      return (
                        <td key={svc.id} className="px-3 py-3 text-center bg-slate-50/50">
                          <span
                            className="inline-flex items-center justify-center w-14 h-6 rounded-full bg-slate-200 text-slate-500 text-[10px] font-medium"
                            title="Canviポータルは基幹システム。全員に自動付与されています"
                          >
                            自動付与
                          </span>
                        </td>
                      )
                    }
                    return (
                      <td key={svc.id} className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(s.user_id!, svc.id)}
                          disabled={pending}
                          className={`w-14 h-6 rounded-full transition-colors relative ${
                            isOn ? 'bg-indigo-600' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                              isOn ? 'translate-x-8' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={services.length + 1} className="px-4 py-8 text-center text-sm text-slate-500">
                  該当ユーザーがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
        💡 トグルをONにすると即座にそのユーザーに付与されます。ユーザー側の「マイサービス」ページにすぐ反映されます。<br />
        🏛 <strong>Canviポータル</strong>は基幹システムのため、ログインできる全ユーザーへ自動的に付与されます（手動切替不可）。
      </div>
    </div>
  )
}
