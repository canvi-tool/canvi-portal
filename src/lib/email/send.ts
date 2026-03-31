import { Resend } from 'resend'

/** Resendクライアントを遅延初期化（ビルド時のトップレベル実行を回避） */
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY が設定されていません')
  }
  return new Resend(apiKey)
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@canvi.co.jp'
const FROM_NAME = process.env.RESEND_FROM_NAME || 'Canvi Portal'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

/** HTMLをフルドキュメントでラップ（charset指定で文字化け防止） */
function wrapHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Canvi Portal</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;">
${bodyHtml}
</body>
</html>`
}

/** HTMLからプレーンテキストを抽出 */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<hr[^>]*>/gi, '\n---\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  const resend = getResendClient()
  const fullHtml = wrapHtml(html)
  const plainText = text || htmlToText(html)

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject,
    html: fullHtml,
    text: plainText,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })

  if (error) {
    console.error('Email send error:', error)
    throw new Error(`メール送信に失敗しました: ${error.message}`)
  }

  return data
}

/** オンボーディング招待メール */
export function buildOnboardingInviteEmail(params: {
  staffName: string
  onboardingUrl: string
}) {
  return {
    subject: '【Canvi】スタッフ登録のご案内',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: #4f46e5; color: white; font-size: 24px; font-weight: bold; width: 48px; height: 48px; line-height: 48px; border-radius: 12px;">C</div>
          <h1 style="margin: 10px 0 0; font-size: 20px; color: #1e293b;">Canvi Portal</h1>
        </div>
        <p style="color: #334155; font-size: 16px;">${params.staffName} 様</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.8;">
          Canviへの入職にあたり、スタッフ登録のご案内をお送りいたします。<br />
          以下のリンクから必要事項をご入力ください。
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${params.onboardingUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
            スタッフ登録フォームを開く
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">
          ※このリンクは一度限り有効です。問題がある場合は管理者にお問い合わせください。
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">Canvi Portal</p>
      </div>
    `,
  }
}

/** 承認依頼メール（オーナー宛） */
export function buildApprovalRequestEmail(params: {
  staffName: string
  approvalUrl: string
}) {
  return {
    subject: `【Canvi】${params.staffName}さんのスタッフ登録承認依頼`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: #4f46e5; color: white; font-size: 24px; font-weight: bold; width: 48px; height: 48px; line-height: 48px; border-radius: 12px;">C</div>
          <h1 style="margin: 10px 0 0; font-size: 20px; color: #1e293b;">Canvi Portal</h1>
        </div>
        <p style="color: #334155; font-size: 14px; line-height: 1.8;">
          <strong>${params.staffName}</strong> さんがスタッフ登録フォームを送信しました。<br />
          内容を確認し、承認をお願いいたします。
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${params.approvalUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
            承認画面を開く
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">Canvi Portal</p>
      </div>
    `,
  }
}

/** 情報補完依頼メール（既存スタッフ向け） */
export function buildInfoUpdateRequestEmail(params: {
  staffName: string
  infoUpdateUrl: string
}) {
  return {
    subject: '【Canvi】スタッフ情報の更新のお願い',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: #4f46e5; color: white; font-size: 24px; font-weight: bold; width: 48px; height: 48px; line-height: 48px; border-radius: 12px;">C</div>
          <h1 style="margin: 10px 0 0; font-size: 20px; color: #1e293b;">Canvi Portal</h1>
        </div>
        <p style="color: #334155; font-size: 16px;">${params.staffName} 様</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.8;">
          スタッフ情報に不足している項目がございます。<br />
          お手数ですが、以下のリンクから情報の入力・更新をお願いいたします。<br />
          既に登録済みの情報は反映されていますので、不足分のみご入力ください。
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${params.infoUpdateUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
            情報更新フォームを開く
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">
          ※このリンクは7日間有効です。期限切れの場合は管理者にお問い合わせください。
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">Canvi Portal</p>
      </div>
    `,
  }
}

/** アカウント発行完了メール */
export function buildAccountActivatedEmail(params: {
  staffName: string
  canviEmail: string
  loginUrl: string
}) {
  return {
    subject: '【Canvi】Googleアカウントが発行されました',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: #4f46e5; color: white; font-size: 24px; font-weight: bold; width: 48px; height: 48px; line-height: 48px; border-radius: 12px;">C</div>
          <h1 style="margin: 10px 0 0; font-size: 20px; color: #1e293b;">Canvi Portal</h1>
        </div>
        <p style="color: #334155; font-size: 16px;">${params.staffName} 様</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.8;">
          スタッフ登録が承認され、Canviアカウントが発行されました。
        </p>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Canviメールアドレス:</strong></p>
          <p style="margin: 4px 0 0; font-size: 18px; color: #1e293b; font-weight: 600;">${params.canviEmail}</p>
        </div>
        <p style="color: #334155; font-size: 14px; line-height: 1.8;">
          以下のリンクから初回ログインし、パスワードを設定してください。<br />
          パスワード設定完了後、Canvi Portalにログインできるようになります。
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${params.loginUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600;">
            初回ログイン・パスワード設定
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">Canvi Portal</p>
      </div>
    `,
  }
}
