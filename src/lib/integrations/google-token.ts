import { createAdminClient } from '@/lib/supabase/admin'

interface TokenInfo {
  accessToken: string
  refreshToken: string | null
  expiresAt: string | null
}

/**
 * 環境変数から値を読み取り、前後の空白/引用符/改行を除去する。
 * Vercel Dashboard に値を貼り付けた際に誤って末尾改行が入ると
 * Google から invalid_client が返るため防御的に trim する。
 */
function cleanEnv(value: string | undefined): string {
  if (!value) return ''
  return value.trim().replace(/^['"]|['"]$/g, '').trim()
}

// Google env var キャッシュ（env → DB fallback）
const _googleEnvCache: Record<string, string> = {}

async function resolveGoogleEnv(key: string): Promise<string> {
  if (_googleEnvCache[key]) return _googleEnvCache[key]

  const envVal = cleanEnv(process.env[key])
  if (envVal) {
    _googleEnvCache[key] = envVal
    return envVal
  }

  console.warn(`[google-token] process.env.${key} is empty. Trying DB fallback...`)
  try {
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single()
    const val = (data as { value: string } | null)?.value
    if (val) {
      const cleaned = cleanEnv(val)
      if (cleaned) {
        _googleEnvCache[key] = cleaned
        console.log(`[google-token] Got ${key} from DB (len=${cleaned.length})`)
        return cleaned
      }
    }
  } catch (err) {
    console.error(`[google-token] DB fallback for ${key} failed:`, err)
  }
  return ''
}

export async function getValidTokenForUser(userId: string): Promise<TokenInfo | null> {
  const admin = createAdminClient()
  const { data: user } = await admin
    .from('users')
    .select('google_access_token, google_refresh_token, google_token_expires_at')
    .eq('id', userId)
    .single()

  if (!user?.google_access_token) return null

  const expiresAt = user.google_token_expires_at
    ? new Date(user.google_token_expires_at)
    : null

  // トークンが期限切れ or 5分以内に切れる場合はリフレッシュ
  if (expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    if (!user.google_refresh_token) return null

    const refreshed = await refreshAccessToken(userId, user.google_refresh_token)
    if (!refreshed) return null

    return refreshed
  }

  return {
    accessToken: user.google_access_token,
    refreshToken: user.google_refresh_token,
    expiresAt: user.google_token_expires_at,
  }
}

/**
 * トークンを強制リフレッシュする（cronジョブ用）
 * getValidTokenForUser と異なり、期限チェックをスキップして常にリフレッシュを試みる
 */
export async function forceRefreshToken(userId: string): Promise<TokenInfo | null> {
  const admin = createAdminClient()
  const { data: user } = await admin
    .from('users')
    .select('google_refresh_token')
    .eq('id', userId)
    .single()

  if (!user?.google_refresh_token) return null
  return refreshAccessToken(userId, user.google_refresh_token)
}

async function refreshAccessToken(
  userId: string,
  refreshToken: string
): Promise<TokenInfo | null> {
  const clientId = await resolveGoogleEnv('GOOGLE_CLIENT_ID')
  const clientSecret = await resolveGoogleEnv('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    console.error(
      '[refreshAccessToken] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が未設定です（env + DB both failed）',
    )
    return null
  }
  try {
    // googleapis の refreshAccessToken は内部エラーを握りつぶすことがあるため
    // 直接 oauth2.googleapis.com/token を叩いてエラー内容を取得する
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken.trim(),
      grant_type: 'refresh_token',
    })
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const j = (await res.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      error?: string
      error_description?: string
    }
    if (!res.ok || !j.access_token) {
      console.error(
        '[refreshAccessToken] Google refresh failed for',
        userId,
        j.error,
        j.error_description,
      )
      return null
    }

    const expiresAt = new Date(
      Date.now() + (j.expires_in ?? 3600) * 1000,
    ).toISOString()

    const admin = createAdminClient()
    await admin
      .from('users')
      .update({
        google_access_token: j.access_token,
        google_refresh_token: j.refresh_token || refreshToken,
        google_token_expires_at: expiresAt,
      })
      .eq('id', userId)

    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token || refreshToken,
      expiresAt,
    }
  } catch (error) {
    console.error('[refreshAccessToken] unexpected error for', userId, error)
    return null
  }
}

