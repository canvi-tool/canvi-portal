import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || !isOwner(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const admin = createAdminClient()

    // 全ユーザーを取得
    const { data: users } = await admin
      .from('users')
      .select('id, email, display_name')
      .order('display_name')

    if (!users) {
      return NextResponse.json({ users: [] })
    }

    // Supabase Auth の全ユーザー情報を取得（identities含む）
    const { data: authData } = await admin.auth.admin.listUsers({
      perPage: 1000,
    })

    const authUsers = authData?.users || []

    // 各ユーザーのGoogle連携状況をチェック
    const usersWithGoogleStatus = users.map((u) => {
      const authUser = authUsers.find((au) => au.id === u.id)
      const identities = authUser?.identities || []
      const googleIdentity = identities.find((i) => i.provider === 'google')
      const hasPasswordSetup = !(authUser?.user_metadata?.needs_password_setup)

      return {
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        google_linked: !!googleIdentity,
        google_email: googleIdentity?.identity_data?.email || null,
        password_setup_done: hasPasswordSetup,
      }
    })

    return NextResponse.json({ users: usersWithGoogleStatus })
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    return NextResponse.json(
      { error: '予期しないエラーが発生しました' },
      { status: 500 }
    )
  }
}
