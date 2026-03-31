import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'

/**
 * 毎朝8:00 JST に未回答フォームのリマインダーメールを送信
 * Vercel Cron: 0 23 * * * (UTC 23:00 = JST 08:00)
 */
export async function GET(request: NextRequest) {
  // Vercel Cronの認証チェック
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://canvi-portal.vercel.app'

    // 全スタッフ取得
    const { data: allStaff } = await supabase
      .from('staff')
      .select('id, last_name, first_name, email, personal_email, custom_fields')

    if (!allStaff) {
      return NextResponse.json({ message: 'No staff data', sent: 0 })
    }

    let sentCount = 0
    let errorCount = 0
    const results: Array<{ name: string; type: string; email: string; success: boolean }> = []

    for (const staff of allStaff) {
      const cf = (staff.custom_fields as Record<string, unknown>) || {}

      // ① オンボーディング未回答リマインダー
      if (cf.onboarding_token && cf.onboarding_status === 'pending_registration') {
        const targetEmail = staff.personal_email || staff.email
        if (targetEmail) {
          const token = cf.onboarding_token as string
          const onboardingUrl = `${siteUrl}/onboarding/${token}`
          try {
            await sendEmail({
              to: targetEmail,
              subject: '【Canvi】スタッフ登録フォームのご入力をお願いします（リマインダー）',
              html: buildReminderHtml({
                staffName: `${staff.last_name} ${staff.first_name}`,
                formUrl: onboardingUrl,
                formType: 'スタッフ登録',
              }),
            })
            sentCount++
            results.push({ name: `${staff.last_name} ${staff.first_name}`, type: 'onboarding', email: targetEmail, success: true })
          } catch (err) {
            console.error(`Reminder email error (onboarding) for ${staff.id}:`, err)
            errorCount++
            results.push({ name: `${staff.last_name} ${staff.first_name}`, type: 'onboarding', email: targetEmail, success: false })
          }
        }
      }

      // ② 情報更新未回答リマインダー
      if (cf.info_update_token && !cf.info_update_completed_at) {
        // 有効期限チェック
        const expiresAt = cf.info_update_expires_at as string | undefined
        if (expiresAt && new Date(expiresAt) < new Date()) {
          continue // 期限切れはスキップ
        }

        const targetEmail = staff.email || staff.personal_email
        if (targetEmail) {
          const token = cf.info_update_token as string
          const infoUpdateUrl = `${siteUrl}/info-update/${token}`
          try {
            await sendEmail({
              to: targetEmail,
              subject: '【Canvi】スタッフ情報の更新をお願いします（リマインダー）',
              html: buildReminderHtml({
                staffName: `${staff.last_name} ${staff.first_name}`,
                formUrl: infoUpdateUrl,
                formType: '情報更新',
              }),
            })
            sentCount++
            results.push({ name: `${staff.last_name} ${staff.first_name}`, type: 'info_update', email: targetEmail, success: true })
          } catch (err) {
            console.error(`Reminder email error (info_update) for ${staff.id}:`, err)
            errorCount++
            results.push({ name: `${staff.last_name} ${staff.first_name}`, type: 'info_update', email: targetEmail, success: false })
          }
        }
      }
    }

    console.log(`[Cron Reminder] Sent: ${sentCount}, Errors: ${errorCount}`)

    return NextResponse.json({
      message: `リマインダー送信完了: ${sentCount}件成功, ${errorCount}件失敗`,
      sent: sentCount,
      errors: errorCount,
      details: results,
    })
  } catch (err) {
    console.error('Cron reminder error:', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

function buildReminderHtml(params: {
  staffName: string
  formUrl: string
  formType: string
}) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background: #4f46e5; color: white; font-size: 24px; font-weight: bold; width: 48px; height: 48px; line-height: 48px; border-radius: 12px;">C</div>
        <h1 style="margin: 10px 0 0; font-size: 20px; color: #1e293b;">Canvi Portal</h1>
      </div>
      <p style="color: #334155; font-size: 16px;">${params.staffName} 様</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.8;">
        ${params.formType}フォームのご入力がまだ完了しておりません。<br />
        お手数ですが、以下のリンクからご入力をお願いいたします。
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${params.formUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
          ${params.formType}フォームを開く
        </a>
      </div>
      <p style="color: #94a3b8; font-size: 12px;">
        ※既にご入力済みの場合は、このメールは無視してください。
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">Canvi Portal</p>
    </div>
  `
}
