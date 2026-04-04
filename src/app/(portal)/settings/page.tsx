import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Shield, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const SETTING_CARDS = [
  {
    title: 'ロール・権限管理',
    description: 'ユーザーへのロール割り当てと、各ロールの権限設定を一元管理します。',
    href: '/settings/user-roles',
    icon: Shield,
  },
  {
    title: 'マイナンバー担当者管理',
    description: 'マイナンバー法に基づく特定個人情報取扱担当者の指定・管理を行います。担当者のみが本人確認書類を閲覧できます。',
    href: '/settings/my-number-handlers',
    icon: ShieldCheck,
  },
]

export default async function SettingsPage() {
  // デモモード以外ではSupabase認証チェック
  if (!DEMO_MODE) {
    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/server')
      const { redirect } = await import('next/navigation')
      const supabase = await createServerSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        redirect('/dashboard')
        return // unreachable but helps TypeScript narrow
      }

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role_id, roles(name)')
        .eq('user_id', user.id)

      const isOwner = userRoles?.some(
        (ur: { roles: { name: string } | null }) => ur.roles?.name === 'owner'
      ) ?? false

      if (!isOwner) {
        redirect('/dashboard')
      }
    } catch {
      // Supabase接続エラー時はダッシュボードへ
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="設定"
        description="システムの各種設定を管理します。オーナーのみアクセス可能です。"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {SETTING_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.href} href={card.href} className="block">
              <Card className="h-full transition-colors hover:bg-muted/50 cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base">{card.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {card.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
