// ============================================================
// POST /api/admin/portal-invites
// Canvi統合招待: Portalアカウント発行 + サービス付与 + ウェルカムメール
// 管理者(owner/admin)のみ実行可
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isPlatformOwner } from '@/lib/auth/rbac'
import { sendEmail, buildWelcomeLoginEmail } from '@/lib/email/send'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1).max(100),
  role: z.enum(['owner', 'admin', 'staff']).default('staff'),
  service_ids: z.array(z.string().uuid()).default([]),
  initial_password: z.string().min(8).optional(), // 未指定時はランダム生成
})

function generateInitialPassword(): string {
  // Canvi + ランダム4桁数字 + ca で初期PWを発行（要件: 8文字以上、大小英数含む）
  const num = Math.floor(1000 + Math.random() * 9000)
  return `Canvi${num}ca`
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 認可チェック
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
    // プラットフォーム管理者（岡林）のみ許可
    if (!isPlatformOwner(currentUser)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = inviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { email, display_name, role, service_ids } = parsed.data
    const initialPassword = parsed.data.initial_password ?? generateInitialPassword()
    const emailLower = email.toLowerCase()

    const adminClient = createAdminClient()
    const serverClient = await createServerSupabaseClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = serverClient as any

    // 1. 既存ユーザーチェック
    const { data: existing } = await sb
      .from('users')
      .select('id')
      .eq('email', emailLower)
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: 'USER_EXISTS', message_ja: 'このメールアドレスは既に登録されています。' },
        { status: 409 },
      )
    }

    // 2. Supabase auth.users 作成（needs_password_setup + needs_google_link フラグ付与）
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: emailLower,
      password: initialPassword,
      email_confirm: true,
      user_metadata: {
        display_name,
        needs_password_setup: true,
        needs_google_link: true,
        invited_by: currentUser.id,
      },
    })
    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error: 'AUTH_CREATE_FAILED',
          message_ja: 'アカウント作成に失敗しました: ' + (authError?.message ?? 'unknown'),
        },
        { status: 500 },
      )
    }
    const userId = authData.user.id

    // 3. public.users に upsert
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminSb = adminClient as any
    await adminSb.from('users').upsert(
      { id: userId, email: emailLower, display_name, locale: 'ja' },
      { onConflict: 'id' },
    )

    // 4. ロール付与
    const { data: roleRow } = await adminSb
      .from('roles')
      .select('id')
      .eq('name', role)
      .maybeSingle()
    if (roleRow?.id) {
      await adminSb
        .from('user_roles')
        .upsert({ user_id: userId, role_id: roleRow.id }, { onConflict: 'user_id,role_id' })
    }

    // 5. サービス付与
    let grantedServices: Array<{ name: string; category: string | null; url: string | null }> = []
    if (service_ids.length > 0) {
      const inserts = service_ids.map((service_id) => ({
        user_id: userId,
        service_id,
        granted_by: currentUser.id,
      }))
      await adminSb.from('user_service_access').insert(inserts)

      const { data: serviceRows } = await adminSb
        .from('canvi_services')
        .select('name, category, url')
        .in('id', service_ids)
      grantedServices = (serviceRows ?? []) as typeof grantedServices
    }

    // 6. ウェルカムメール送信
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://canvi-portal.vercel.app'
    const loginUrl = `${baseUrl.replace(/\/$/, '')}/login`

    const mail = buildWelcomeLoginEmail({
      displayName: display_name,
      email: emailLower,
      initialPassword,
      loginUrl,
      grantedServices,
    })
    const sendResult = await sendEmail({
      to: emailLower,
      subject: mail.subject,
      html: mail.html,
    }).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }))

    return NextResponse.json(
      {
        ok: true,
        user_id: userId,
        email: emailLower,
        granted_services: grantedServices.length,
        email_sent: !(sendResult && 'error' in sendResult),
        email_error: sendResult && 'error' in sendResult ? sendResult.error : null,
        initial_password: initialPassword, // 管理者に表示（手動共有用フォールバック）
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[portal-invites]', err)
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message_ja: '招待処理に失敗しました。',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    )
  }
}
