import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/rbac'
import { staffInviteSchema } from '@/lib/validations/staff'
import { generateNextStaffCode } from '@/lib/staff-code'
import { sendEmail, buildOnboardingInviteEmail } from '@/lib/email/send'
import type { Json } from '@/lib/types/database'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin().catch((err) => {
      console.error('requireAdmin failed:', err?.message, err)
      return null
    })
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

    const { last_name, first_name, personal_email, employment_type } = result.data
    const supabase = createAdminClient()

    // 同じメールで既に招待済みかチェック（custom_fieldsにonboarding_tokenがあるsuspendedレコード）
    const { data: existingList } = await supabase
      .from('staff')
      .select('id, status, custom_fields')
      .eq('personal_email', personal_email)
      .eq('status', 'suspended')

    const existing = existingList?.find((s) => {
      const cf = s.custom_fields as Record<string, unknown> | null
      return cf?.onboarding_token && !cf?.onboarding_completed
    })

    if (existing) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に招待済みです' },
        { status: 409 }
      )
    }

    // トークン生成
    const token = crypto.randomUUID()

    // スタッフコード自動採番（S0001〜S9999の空き番号）
    const staffCode = await generateNextStaffCode(supabase)

    // スタッフレコードを仮作成（status = suspended をオンボーディング中として使用）
    const { data: staff, error } = await supabase
      .from('staff')
      .insert({
        last_name,
        first_name,
        email: personal_email,
        personal_email,
        staff_code: staffCode,
        employment_type,
        status: 'suspended',
        hire_date: new Date().toISOString().split('T')[0],
        custom_fields: {
          onboarding_token: token,
          onboarding_status: 'pending_registration',
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
    let emailSent = false
    let emailError: string | null = null
    try {
      const emailContent = buildOnboardingInviteEmail({
        staffName: `${last_name} ${first_name}`,
        onboardingUrl,
      })
      const result = await sendEmail({
        to: personal_email,
        ...emailContent,
      })
      emailSent = true
      console.log('Invite email sent:', result)
    } catch (emailErr) {
      emailError = emailErr instanceof Error ? emailErr.message : String(emailErr)
      console.error('Invite email send error:', emailErr)
    }

    return NextResponse.json({
      id: staff.id,
      onboarding_url: onboardingUrl,
      email_sent: emailSent,
      email_error: emailError,
      message: emailSent
        ? `${personal_email} に招待メールを送信しました`
        : `スタッフレコードは作成しましたが、メール送信に失敗しました: ${emailError}`,
    }, { status: 201 })
  } catch (err) {
    console.error('Staff invite error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
