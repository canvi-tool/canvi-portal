/**
 * GET /api/cron/google-token-refresh
 *
 * 6時間ごとに実行し、全ユーザーの Google トークンをプロアクティブにリフレッシュする。
 * google_refresh_token を持つ全ユーザーを対象に forceRefreshToken を呼び出し、
 * 失敗した場合は google_token_status を 'needs_reauth' に更新する。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { forceRefreshToken } from '@/lib/integrations/google-token'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // google_refresh_token を持つ全ユーザーを取得
  const { data: users, error: usersError } = await admin
    .from('users')
    .select('id, google_token_expires_at, google_last_auth_at, google_token_status')
    .not('google_refresh_token', 'is', null)

  if (usersError) {
    console.error('[google-token-refresh] Failed to fetch users:', usersError.message)
    return NextResponse.json({ error: usersError.message }, { status: 500 })
  }

  if (!users || users.length === 0) {
    return NextResponse.json({
      message: 'No users with Google tokens',
      refreshed: 0,
      failed: 0,
      needsReauth: 0,
    })
  }

  console.log(`[google-token-refresh] Processing ${users.length} users`)

  let refreshed = 0
  let failed = 0
  let needsReauth = 0
  const errors: string[] = []

  for (const user of users) {
    try {
      const token = await forceRefreshToken(user.id)

      if (!token) {
        // リフレッシュ失敗 → needs_reauth に更新
        await admin
          .from('users')
          .update({ google_token_status: 'needs_reauth' })
          .eq('id', user.id)
        needsReauth++
        continue
      }

      // トークンリフレッシュ成功 → active に更新
      await admin
        .from('users')
        .update({ google_token_status: 'active' })
        .eq('id', user.id)
      refreshed++
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      errors.push(`user ${user.id}: ${message}`)
      console.error(`[google-token-refresh] Error for user ${user.id}:`, e)
      failed++
    }
  }

  console.log(
    `[google-token-refresh] Complete: ${refreshed} refreshed, ${failed} failed, ${needsReauth} needs_reauth`
  )

  return NextResponse.json({
    message: 'Token refresh complete',
    total: users.length,
    refreshed,
    failed,
    needsReauth,
    errors: errors.slice(0, 10),
  })
}
