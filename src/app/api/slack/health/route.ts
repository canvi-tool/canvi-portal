import { NextResponse } from 'next/server'

/**
 * GET /api/slack/health
 * Slack接続診断エンドポイント（認証不要・テスト用）
 */
export async function GET() {
  const botToken = process.env.SLACK_BOT_TOKEN
  const userToken = process.env.SLACK_USER_TOKEN

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    bot_token_set: !!botToken,
    user_token_set: !!userToken,
  }

  // Test bot token
  if (botToken) {
    try {
      const res = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      const data = await res.json()
      results.bot = {
        ok: data.ok,
        team: data.team,
        user: data.user,
        bot_id: data.bot_id,
        error: data.error || undefined,
      }
    } catch (e) {
      results.bot = { ok: false, error: String(e) }
    }
  }

  // Test user token
  if (userToken) {
    try {
      const res = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      const data = await res.json()
      results.user = {
        ok: data.ok,
        team: data.team,
        user: data.user,
        error: data.error || undefined,
      }
    } catch (e) {
      results.user = { ok: false, error: String(e) }
    }
  }

  return NextResponse.json(results)
}
