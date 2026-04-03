import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/rbac'
import { ALLOWED_EMAIL_DOMAINS } from '@/lib/constants'
import { sendEmail, buildWelcomeLoginEmail } from '@/lib/email/send'
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

/** 電話番号下4桁から初期パスワードを生成: Canvi + 下4桁 + ca */
function generateInitialPassword(phone: string | null): string {
  const digits = phone ? phone.replace(/\D/g, '').slice(-4) : '0000'
  const padded = digits.padStart(4, '0')
  return `Canvi${padded}ca`
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { email, display_name, role } = inviteSchema.parse(body)

    const admin = createAdminClient()

    // staffテーブルから電話番号を取得
    const { data: staffRecord } = await admin
      .from('staff')
      .select('phone')
      .eq('email', email)
      .single()

    const initialPassword = generateInitialPassword(staffRecord?.phone ?? null)

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
          needs_google_link: true,
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

    // 初回ログイン案内メールを送信
    let emailSent = false
    let emailError: string | undefined
    try {
      const loginUrl = process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
        : 'https://canvi-portal.vercel.app/login'

      const emailContent = buildWelcomeLoginEmail({
        displayName: display_name,
        email,
        initialPassword,
        loginUrl,
      })

      await sendEmail({
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
      })
      emailSent = true
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'メール送信に失敗しました'
    }

    return NextResponse.json({
      message: `${display_name} のアカウントを作成しました${emailSent ? '（案内メール送信済）' : ''}`,
      user_id: userData.user?.id,
      initial_password: initialPassword,
      email_sent: emailSent,
      email_error: emailError,
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
