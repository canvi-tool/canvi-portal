import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { staffInviteSchema } from '@/lib/validations/staff'
import { sendEmail, buildOnboardingInviteEmail } from '@/lib/email/send'
import type { Json } from '@/lib/types/database'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin().catch(() => null)
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const result = staffInviteSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'バリデーションエラー' },
        { status: 400 }
      )
    }

    const { last_name, first_name, personal_email } = result.data
    const supabase = await createServerSupabaseClient()

    // 同じメールで既に招待済みかチェック
    const { data: existing } = await supabase
      .from('staff')
      .select('id, status')
      .eq('personal_email', personal_email)
      .in('status', ['pending_registration', 'pending_approval'])
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に招待済みです' },
        { status: 409 }
      )
    }

    // トークン生成
    const token = crypto.randomUUID()

    // スタッフレコードを仮作成（status = pending_registration）
    const { data: staff, error } = await supabase
      .from('staff')
      .insert({
        last_name,
        first_name,
        email: personal_email, // 初期は個人メール、承認後にcanviメールに更新
        personal_email,
        staff_code: `PENDING-${token.slice(0, 8).toUpperCase()}`,
        employment_type: 'full_time',
        status: 'pending_registration',
        custom_fields: {
          onboarding_token: token,
          invited_at: new Date().toISOString(),
          invited_by: admin.id,
        } as unknown as Json,
      })
      .select()
      .single()

    if (error) {
      console.error('Staff invite create error:', error)
      return NextResponse.json(
        { error: 'スタッフ招待の作成に失敗しました' },
        { status: 500 }
      )
    }

    // 監査ログ
    await supabase.from('audit_logs').insert({
      user_id: admin.id,
      action: 'create',
      resource: 'staff',
      resource_id: staff.id,
      new_data: { action: 'invite_onboarding', personal_email, token } as unknown as Record<string, Json>,
    })

    // オンボーディングURLを生成
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://canvi-portal-b9br.vercel.app'
    const onboardingUrl = `${siteUrl}/onboarding/${token}`

    // 招待メール送信
    try {
      const emailContent = buildOnboardingInviteEmail({
        staffName: `${last_name} ${first_name}`,
        onboardingUrl,
      })
      await sendEmail({
        to: personal_email,
        ...emailContent,
      })
    } catch (emailErr) {
      console.error('Invite email send error:', emailErr)
      // メール失敗してもスタッフレコードは作成済み → URLは返す
    }

    return NextResponse.json({
      id: staff.id,
      onboarding_url: onboardingUrl,
      message: `${personal_email} に招待メールを送信しました`,
    }, { status: 201 })
  } catch (err) {
    console.error('Staff invite error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
