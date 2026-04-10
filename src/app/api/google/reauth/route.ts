import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * POST /api/google/reauth
 * Google OAuth再認証のURLを生成して返す
 */
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // Supabase のlinkIdentityでGoogle OAuthを再実行
    // フロントエンドでこのURLにリダイレクトする
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://portal.canvi.co.jp'}/callback?reauth=true`,
        scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ url: data?.url || null })
  } catch (error) {
    console.error('POST /api/google/reauth error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
