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

    // auth.identities を直接クエリ（listUsers の identities が不完全な場合があるため）
    const authSchemaClient = createAdminClient()
    const { data: identitiesRaw } = await (authSchemaClient as ReturnType<typeof createAdminClient>)
      .schema('auth' as 'public')
      .from('identities' as never)
      .select('user_id, provider, identity_data' as '*')

    // Google identity を user_id でマップ
    const googleIdentityMap = new Map<string, { email: string | null }>()
    if (identitiesRaw) {
      for (const identity of identitiesRaw as unknown as { user_id: string; provider: string; identity_data: Record<string, unknown> }[]) {
        if (identity.provider === 'google') {
          googleIdentityMap.set(identity.user_id, {
            email: (identity.identity_data?.email as string) || null,
          })
        }
      }
    }

    // auth.users から needs_password_setup メタデータを取得
    const { data: authData } = await admin.auth.admin.listUsers({
      perPage: 1000,
    })
    const authUsers = authData?.users || []

    // 各ユーザーのGoogle連携状況をチェック
    const usersWithGoogleStatus = users.map((u) => {
      const authUser = authUsers.find((au) => au.id === u.id)
      const googleInfo = googleIdentityMap.get(u.id)
      const hasPasswordSetup = !(authUser?.user_metadata?.needs_password_setup)

      return {
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        google_linked: !!googleInfo,
        google_email: googleInfo?.email || null,
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
