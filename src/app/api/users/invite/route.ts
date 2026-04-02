import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/rbac'
import { ALLOWED_EMAIL_DOMAINS } from '@/lib/constants'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z
    .string()
    .email('有効なメールアドレスを入力してください')
    .refine(
      (email) => {
        const domain = email.split('@')[1]?.toLowerCase()
        return ALLOWED_EMAIL_DOMAINS.includes(domain ?? '')
      },
      { message: `@${ALLOWED_EMAIL_DOMAINS[0]} ドメインのメールアドレスのみ招待できます` }
    ),
  display_name: z.string().min(1, '表示名を入力してください'),
  role: z.enum(['admin', 'staff']).default('staff'),
})

/** 初期パスワードを生成: Canvi + ランダム4桁 + ca */
function generateInitialPassword(): string {
  const digits = String(Math.floor(1000 + Math.random() * 9000))
  return `Canvi${digits}ca`
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { email, display_name, role } = inviteSchema.parse(body)

    const admin = createAdminClient()

    const initialPassword = generateInitialPassword()

    // Supabase Admin API でユーザーを直接作成（初期パスワード付き）
    const { data: userData, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          display_name,
          invited_role: role,
          needs_password_setup: true,
        },
      })

    if (createError) {
      if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
        return NextResponse.json(
          { error: 'このメールアドレスは既に登録されています' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: `ユーザー作成に失敗しました: ${createError.message}` },
        { status: 500 }
      )
    }

    // usersテーブルにレコード作成
    if (userData.user) {
      await admin.from('users').upsert(
        {
          id: userData.user.id,
          email,
          display_name,
        },
        { onConflict: 'id' }
      )

      // ロールを割り当て
      const { data: roleData } = await admin
        .from('roles')
        .select('id')
        .eq('name', role)
        .single()

      if (roleData) {
        await admin.from('user_roles').upsert(
          { user_id: userData.user.id, role_id: roleData.id },
          { onConflict: 'user_id,role_id' }
        )
      }
    }

    return NextResponse.json({
      message: `${display_name} のアカウントを作成しました`,
      user_id: userData.user?.id,
      initial_password: initialPassword,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message || 'バリデーションエラー' },
        { status: 400 }
      )
    }
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
