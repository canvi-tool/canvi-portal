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

    if (error) {
      console.error('OAuth callback exchangeCodeForSession error:', error.message, error)
    }

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

        // Google OAuthログイン時: ポータルのメールアドレスとGoogleアカウントのメールが一致するか検証
        // needs_google_link フロー以外でも、Googleアカウントのメールが一致しない場合はブロック
        const googleIdentityForCheck = user.identities?.find(
          (i) => i.provider === 'google'
        )
        if (googleIdentityForCheck && !user.user_metadata?.needs_google_link) {
          const googleEmail = (googleIdentityForCheck.identity_data?.email as string | undefined)?.toLowerCase()
          const portalEmail = user.email?.toLowerCase()
          if (googleEmail && portalEmail && googleEmail !== portalEmail) {
            // Googleアカウントのメールがポータルのメールと不一致 → ログアウト
            await supabase.auth.signOut()
            return NextResponse.redirect(
              `${origin}/login?error=email_mismatch`
            )
          }
        }

        // Upsert user record in public.users table
        // 既存の display_name を優先し、Google の full_name やメールで上書きしない
        const { data: existingUser } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', user.id)
          .single()

        const displayName =
          existingUser?.display_name ||
          user.user_metadata.display_name ||
          user.user_metadata.full_name ||
          user.email!

        await supabase.from('users').upsert(
          {
            id: user.id,
            email: user.email!,
            display_name: displayName,
            avatar_url: user.user_metadata.avatar_url,
          },
          { onConflict: 'id' }
        )

        // 初回ユーザー（他にユーザーがいなければ）をオーナーに自動設定
        await assignRoleIfFirstUser(supabase, user.id)

        // Google連携: メールアドレス一致チェック + フラグクリア
        if (user.user_metadata?.needs_google_link) {
          const googleIdentity = user.identities?.find(
            (i) => i.provider === 'google'
          )
          const googleEmail = (googleIdentity?.identity_data?.email as string | undefined)?.toLowerCase()
          const portalEmail = user.email?.toLowerCase()

          if (googleEmail && googleEmail !== portalEmail) {
            // メール不一致 → Google identityを解除してエラー
            if (googleIdentity?.id) {
              await supabase.auth.unlinkIdentity({
                id: googleIdentity.id,
                provider: 'google',
              } as Parameters<typeof supabase.auth.unlinkIdentity>[0])
            }
            return NextResponse.redirect(
              `${origin}/setup-password?error=email_mismatch`
            )
          }

          // メール一致 → フラグクリア
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

  console.error('OAuth callback: no code or exchange failed. code:', code ? 'present' : 'missing', 'searchParams:', Object.fromEntries(searchParams.entries()))
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
