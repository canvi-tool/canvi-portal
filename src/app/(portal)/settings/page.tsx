import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Shield, SlidersHorizontal, Plug, FileText, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const SETTING_CARDS = [
  {
    title: 'ポータルユーザー管理',
    description: 'ポータルにログインできるユーザーの招待・管理を行います。招待されたユーザーのみログイン可能です。',
    href: '/settings/users',
    icon: Users,
  },
  {
    title: 'ロール管理',
    description: 'ユーザーのロールと権限を管理します。各ロールに対してリソースごとの権限を設定できます。',
    href: '/settings/roles',
    icon: Shield,
  },
  {
    title: 'カスタムフィールド',
    description: 'スタッフ・契約・プロジェクトなどのエンティティにカスタムフィールドを追加・管理します。',
    href: '/settings/custom-fields',
    icon: SlidersHorizontal,
  },
  {
    title: '外部連携',
    description: 'freee Sign、Google カレンダー、メール送信、Claude AI などの外部サービスとの連携を設定します。',
    href: '/settings/integrations',
    icon: Plug,
  },
  {
    title: '契約テンプレート',
    description: '契約書のテンプレートを管理します。変数の設定やテンプレートの有効/無効を切り替えられます。',
    href: '/contracts/templates',
    icon: FileText,
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
