import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { sendEmail, buildInfoUpdateRequestEmail } from '@/lib/email/send'
import type { Json } from '@/lib/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** POST: 既存スタッフに情報補完フォームのURLを送信 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin().catch(() => null)
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createServerSupabaseClient()

    // スタッフ取得
    const { data: staff, error: fetchError } = await supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !staff) {
      return NextResponse.json({ error: 'スタッフが見つかりません' }, { status: 404 })
    }

    // 送信先メール決定（canviメール > 個人メール）
    const targetEmail = staff.email || staff.personal_email
    if (!targetEmail) {
      return NextResponse.json(
        { error: 'スタッフにメールアドレスが登録されていません' },
        { status: 400 }
      )
    }

    // body からカスタム送信先を取得（任意）
    const body = await request.json().catch(() => ({}))
    const sendTo = (body.send_to as string) || targetEmail

    // トークン生成
    const crypto = await import('crypto')
    const token = crypto.randomUUID()
    const existingFields = (staff.custom_fields as Record<string, unknown>) || {}

    // custom_fieldsにトークンを保存（7日間有効）
    const { error: updateError } = await supabase
      .from('staff')
      .update({
        custom_fields: {
          ...existingFields,
          info_update_token: token,
          info_update_requested_at: new Date().toISOString(),
          info_update_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          info_update_requested_by: admin.id,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Info update token save error:', updateError)
      return NextResponse.json({ error: 'トークンの保存に失敗しました' }, { status: 500 })
    }

    // メール送信
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://canvi-portal.vercel.app'
    const infoUpdateUrl = `${siteUrl}/info-update/${token}`
    let emailSent = false

    try {
      const emailContent = buildInfoUpdateRequestEmail({
        staffName: `${staff.last_name} ${staff.first_name}`,
        infoUpdateUrl,
      })
      await sendEmail({ to: sendTo, ...emailContent })
      emailSent = true
    } catch (emailErr) {
      console.error('Info update email error:', emailErr)
    }

    // 監査ログ
    await supabase.from('audit_logs').insert({
      user_id: admin.id,
      action: 'update',
      resource: 'staff',
      resource_id: id,
      new_data: {
        action: 'request_info_update',
        send_to: sendTo,
        email_sent: emailSent,
      } as unknown as Record<string, Json>,
    })

    return NextResponse.json({
      message: '情報更新依頼を送信しました',
      info_update_url: infoUpdateUrl,
      email_sent: emailSent,
      send_to: sendTo,
    })
  } catch (err) {
    console.error('Request info update error:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
