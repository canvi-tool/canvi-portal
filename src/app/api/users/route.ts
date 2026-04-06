import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/rbac'

export async function GET() {
  try {
    await requireAdmin()

    // 権限チェック済み → RLSをバイパスする admin clientで全ユーザーを取得
    const supabase = createAdminClient()

    // ユーザー一覧をロール付きで取得
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        display_name,
        avatar_url,
        created_at,
        user_roles (
          roles (
            name
          )
        )
      `)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: 'ユーザー一覧の取得に失敗しました' },
        { status: 500 }
      )
    }

    const formattedUsers = (users ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
      created_at: u.created_at,
      roles: (u.user_roles as { roles: { name: string } | null }[])
        ?.map((ur) => ur.roles?.name)
        .filter(Boolean) ?? [],
    }))

    return NextResponse.json({ users: formattedUsers })
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'Forbidden') {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }
    return NextResponse.json(
      { error: '予期しないエラーが発生しました' },
      { status: 500 }
    )
  }
}
