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

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { email, display_name, role } = inviteSchema.parse(body)

    const admin = createAdminClient()

    // Supabase Admin API でユーザーを招待（確認メールが自動送信される）
    const { data: inviteData, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: {
          display_name,
          invited_role: role,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://canvi-portal-b9br.vercel.app'}/callback`,
      })

    if (inviteError) {
      // 既に登録済みの場合
      if (inviteError.message?.includes('already been registered')) {
        return NextResponse.json(
          { error: 'このメールアドレスは既に登録されています' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: `招待に失敗しました: ${inviteError.message}` },
        { status: 500 }
      )
    }

    // usersテーブルにレコード作成
    if (inviteData.user) {
      await admin.from('users').upsert(
        {
          id: inviteData.user.id,
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
          { user_id: inviteData.user.id, role_id: roleData.id },
          { onConflict: 'user_id,role_id' }
        )
      }
    }

    return NextResponse.json({
      message: `${email} に招待メールを送信しました`,
      user_id: inviteData.user?.id,
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
