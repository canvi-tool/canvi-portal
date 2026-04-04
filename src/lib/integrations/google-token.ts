import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'

interface TokenInfo {
  accessToken: string
  refreshToken: string | null
  expiresAt: string | null
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

async function refreshAccessToken(
  userId: string,
  refreshToken: string
): Promise<TokenInfo | null> {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )

    oauth2Client.setCredentials({ refresh_token: refreshToken })
    const { credentials } = await oauth2Client.refreshAccessToken()

    if (!credentials.access_token) return null

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString()

    // DB更新
    const admin = createAdminClient()
    await admin.from('users').update({
      google_access_token: credentials.access_token,
      google_refresh_token: credentials.refresh_token || refreshToken,
      google_token_expires_at: expiresAt,
    }).eq('id', userId)

    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || refreshToken,
      expiresAt,
    }
  } catch (error) {
    console.error('Google token refresh failed for user:', userId, error)
    return null
  }
}
