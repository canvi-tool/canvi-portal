'use client'

import { Lock, ExternalLink } from 'lucide-react'

type Service = {
  id: string
  slug: string
  name: string
  description: string | null
  url: string
  icon_emoji: string | null
  icon_url: string | null
  bg_gradient: string | null
  category: string | null
}

export function AppLauncherGrid({
  services,
  grantedServiceIds,
}: {
  services: Service[]
  grantedServiceIds: Set<string>
}) {
  if (!services.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        利用可能なサービスがまだありません。
      </div>
    )
  }

  // カテゴリ別にグループ化
  const byCategory = services.reduce((acc, s) => {
    const key = s.category || 'その他'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {} as Record<string, Service[]>)

  return (
    <div className="space-y-8">
      {Object.entries(byCategory).map(([category, list]) => (
        <section key={category} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {category}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {list.map((svc) => {
              const granted = grantedServiceIds.has(svc.id)
              const gradient =
                svc.bg_gradient || 'linear-gradient(135deg,#64748b,#475569)'

              const initial = svc.name.charAt(0)
              const content = (
                <>
                  {/* ヘッダー: ロゴ or 頭文字ラベル */}
                  <div
                    className="flex h-28 items-center justify-center relative p-4"
                    style={{
                      background: granted ? gradient : 'linear-gradient(135deg,#cbd5e1,#94a3b8)',
                    }}
                  >
                    {svc.icon_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={svc.icon_url} alt={svc.name} className="h-16 w-16 drop-shadow-sm" />
                    ) : (
                      <div className="text-white text-2xl font-bold tracking-wide drop-shadow-sm text-center leading-tight">
                        {svc.name}
                      </div>
                    )}
                    {!granted && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                        <Lock className="h-3 w-3" />
                        未付与
                      </div>
                    )}
                    {granted && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 text-slate-700 text-xs px-2 py-0.5 rounded-full">
                        <ExternalLink className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                  {/* ボディ: タイトル + 説明 */}
                  <div className="p-4 space-y-1.5">
                    <h3 className={`font-semibold text-sm ${granted ? 'text-slate-900' : 'text-slate-400'}`}>
                      {svc.name}
                    </h3>
                    {svc.description && (
                      <p className={`text-xs leading-relaxed line-clamp-2 ${granted ? 'text-slate-500' : 'text-slate-400'}`}>
                        {svc.description}
                      </p>
                    )}
                  </div>
                </>
              )
              void initial

              if (granted) {
                // SSO 経由でサービスを開く（短命JWT付き）
                const ssoUrl = `/api/sso/launch?slug=${encodeURIComponent(svc.slug)}`
                return (
                  <a
                    key={svc.id}
                    href={ssoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
                  >
                    {content}
                  </a>
                )
              }
              return (
                <div
                  key={svc.id}
                  title="このサービスへのアクセス権がありません。管理者に付与を依頼してください。"
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white opacity-70 cursor-not-allowed"
                >
                  {content}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <div className="mt-8 rounded-lg bg-indigo-50 border border-indigo-200 p-4 text-sm text-indigo-800">
        💡 アクセスしたいサービスがある場合は、管理者（オーナー）にサービス付与を依頼してください。
      </div>
    </div>
  )
}
