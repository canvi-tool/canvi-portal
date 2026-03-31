import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { sendEmail, buildInfoUpdateRequestEmail } from '@/lib/email/send'
import { isFreelanceType } from '@/lib/validations/staff'
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

    // body からカスタム送信先を取得（任意）+ check_onlyフラグ
    const body = await request.json().catch(() => ({}))
    const sendTo = (body.send_to as string) || targetEmail
    const checkOnly = body.check_only === true

    // 不足フィールドを検出
    const isFreelance = isFreelanceType(staff.employment_type)
    const cf = (staff.custom_fields as Record<string, unknown>) || {}
    const missingFields: string[] = []

    // 共通必須
    if (!staff.last_name) missingFields.push('姓')
    if (!staff.first_name) missingFields.push('名')
    if (!staff.last_name_kana) missingFields.push('姓（カナ）')
    if (!staff.first_name_kana) missingFields.push('名（カナ）')
    if (!staff.last_name_eiji) missingFields.push('姓（ローマ字）')
    if (!staff.first_name_eiji) missingFields.push('名（ローマ字）')
    if (!staff.date_of_birth) missingFields.push('生年月日')
    if (!staff.phone) missingFields.push('電話番号')
    if (!staff.postal_code) missingFields.push('郵便番号')
    if (!staff.prefecture) missingFields.push('都道府県')
    if (!staff.address_line1) missingFields.push('住所')
    if (!staff.bank_name) missingFields.push('銀行名')
    if (!staff.bank_branch) missingFields.push('支店名')
    if (!staff.bank_account_number) missingFields.push('口座番号')
    if (!staff.bank_account_holder) missingFields.push('口座名義')

    // 業務委託以外: 緊急連絡先 + 本人確認書類
    if (!isFreelance) {
      if (!staff.emergency_contact_name) missingFields.push('緊急連絡先（氏名）')
      if (!staff.emergency_contact_phone) missingFields.push('緊急連絡先（電話番号）')
      if (!cf.identity_document) missingFields.push('本人確認書類')
    }

    // check_only: 不足情報だけ返す（送信しない）
    if (checkOnly) {
      return NextResponse.json({
        missing_fields: missingFields,
        all_filled: missingFields.length === 0,
      })
    }

    // トークン生成
    const crypto = await import('crypto')
    const token = crypto.randomUUID()
    const existingFields = (staff.custom_fields as Record<string, unknown>) || {}

    // custom_fieldsにトークンを保存（7日間有効）
    // 前回のcompleted_atをクリアして新しいフォームを開けるようにする
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { info_update_completed_at: _cleared, ...cleanFields } = existingFields
    const { error: updateError } = await supabase
      .from('staff')
      .update({
        custom_fields: {
          ...cleanFields,
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
      missing_fields: missingFields,
    })
  } catch (err) {
    console.error('Request info update error:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
