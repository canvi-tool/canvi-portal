import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/google/status
 * 現在のユーザーのGoogleトークン状態を返す
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: userData } = await admin
      .from('users')
      .select('google_access_token, google_refresh_token, google_token_expires_at, google_last_auth_at, google_token_status')
      .eq('id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ connected: false, status: 'disconnected' })
    }

    const connected = !!userData.google_access_token
    const status = userData.google_token_status || (connected ? 'active' : 'disconnected')
    const lastAuthAt = userData.google_last_auth_at || null
    const expiresAt = userData.google_token_expires_at || null

    // 6時間以上経過しているか判定
    const needsReauth = !lastAuthAt ||
      (new Date().getTime() - new Date(lastAuthAt).getTime() > 6 * 60 * 60 * 1000)

    return NextResponse.json({
      connected,
      status: needsReauth ? 'needs_reauth' : status,
      lastAuthAt,
      expiresAt,
      needsReauth,
    })
  } catch (error) {
    console.error('GET /api/google/status error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
