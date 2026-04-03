import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { ALLOWED_EMAIL_DOMAINS } from '@/lib/constants'

/** メールアドレスのドメインが許可リストに含まれるか確認 */
function isAllowedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return ALLOWED_EMAIL_DOMAINS.includes(domain ?? '')
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // ドメイン制限チェック
        if (!isAllowedDomain(user.email ?? '')) {
          // 許可されていないドメイン → セッション削除してログインページへ
          await supabase.auth.signOut()
          return NextResponse.redirect(
            `${origin}/login?error=domain_not_allowed`
          )
        }

        // Upsert user record in public.users table
        await supabase.from('users').upsert(
          {
            id: user.id,
            email: user.email!,
            display_name:
              user.user_metadata.full_name || user.email!,
            avatar_url: user.user_metadata.avatar_url,
          },
          { onConflict: 'id' }
        )

        // 初回ユーザー（他にユーザーがいなければ）をオーナーに自動設定
        await assignRoleIfFirstUser(supabase, user.id)

        // Google連携完了 → needs_google_link フラグをクリア
        if (user.user_metadata?.needs_google_link) {
          const admin = createAdminClient()
          await admin.auth.admin.updateUserById(user.id, {
            user_metadata: { needs_google_link: false },
          })
        }

        // 招待ユーザー（パスワード未設定）→ パスワード設定画面へ
        if (user.user_metadata?.needs_password_setup) {
          return NextResponse.redirect(`${origin}/setup-password`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}

async function assignRoleIfFirstUser(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string
) {
  // 既にロールが割り当てられていれば何もしない
  const { data: existingRole } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)
    .limit(1)

  if (existingRole && existingRole.length > 0) return

  // ユーザー数を確認 - 1人目ならオーナー
  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })

  const isFirstUser = (count ?? 0) <= 1

  // オーナーまたはスタッフロールを取得
  const roleName = isFirstUser ? 'owner' : 'staff'
  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .single()

  if (role) {
    await supabase.from('user_roles').upsert(
      { user_id: userId, role_id: role.id },
      { onConflict: 'user_id,role_id' }
    )
  }
}
