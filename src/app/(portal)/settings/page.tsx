import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Shield, SlidersHorizontal, Plug, FileText, Users, ShieldCheck, UserCog, Link2 } from 'lucide-react'

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
    title: 'ユーザーロール管理',
    description: '全ポータルユーザーのロール（権限グループ）を一覧表示し、割り当て・解除を行います。',
    href: '/settings/user-roles',
    icon: UserCog,
  },
  {
    title: 'マイナンバー担当者管理',
    description: 'マイナンバー法に基づく特定個人情報取扱担当者の指定・管理を行います。担当者のみが本人確認書類を閲覧できます。',
    href: '/settings/my-number-handlers',
    icon: ShieldCheck,
  },
  {
    title: 'Googleアカウント連携管理',
    description: '全メンバーのGoogleアカウント連携状況を確認します。連携済・未連携のステータスを一覧で管理できます。',
    href: '/settings/google-auth',
    icon: Link2,
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
