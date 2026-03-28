import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken } from '@/lib/integrations/freee-sign'

/**
 * freee Sign OAuth 2.0コールバック
 *
 * 認可コードを受け取り、アクセストークンに交換する。
 * 取得したトークンはログに出力し、環境変数として設定するよう案内する。
 * （本番ではDBやSecret Managerに保存）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      console.error('[freee Sign OAuth] Error:', error)
      return NextResponse.redirect(
        new URL(`/settings/integrations?error=${encodeURIComponent('freee Sign認証に失敗しました: ' + error)}`, request.url)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings/integrations?error=' + encodeURIComponent('認証パラメータが不足しています'), request.url)
      )
    }

    // トークン交換
    const tokenResponse = await exchangeCodeForToken(code)

    // トークンをログ出力（本番ではDBに保存）
    console.log('[freee Sign OAuth] Token received successfully')
    console.log('[freee Sign OAuth] Set FREEE_SIGN_ACCESS_TOKEN env var with:', tokenResponse.access_token.slice(0, 10) + '...')
    console.log('[freee Sign OAuth] Refresh token:', tokenResponse.refresh_token.slice(0, 10) + '...')
    console.log('[freee Sign OAuth] Expires in:', tokenResponse.expires_in, 'seconds')

    return NextResponse.redirect(
      new URL('/settings/integrations?success=' + encodeURIComponent('freee Signと接続しました。トークンはサーバーログを確認してください。'), request.url)
    )
  } catch (err) {
    console.error('[freee Sign OAuth] Callback error:', err)
    return NextResponse.redirect(
      new URL('/settings/integrations?error=' + encodeURIComponent('freee Sign接続中にエラーが発生しました'), request.url)
    )
  }
}
