import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/slack/health
 * Slack接続診断エンドポイント（認証不要・テスト用）
 * ?channel=CHANNEL_ID を付けるとそのチャンネルへのテストメッセージ送信も行う
 */
export async function GET(request: NextRequest) {
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

  // Test conversations.list (same API used by fetchSlackChannels)
  if (botToken) {
    try {
      const listRes = await fetch('https://slack.com/api/conversations.list?types=public_channel&exclude_archived=true&limit=3', {
        headers: { Authorization: `Bearer ${botToken}` },
      })
      const listData = await listRes.json()
      results.conversations_list = {
        ok: listData.ok,
        channel_count: listData.channels?.length ?? 0,
        sample: listData.channels?.slice(0, 2).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })),
        error: listData.error || undefined,
      }
    } catch (e) {
      results.conversations_list = { ok: false, error: String(e) }
    }
  }

  // Optional: test channel access & send test message
  const channelId = new URL(request.url).searchParams.get('channel')
  if (channelId && botToken) {
    try {
      // Check bot membership in channel
      const infoRes = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
        headers: { Authorization: `Bearer ${botToken}` },
      })
      const infoData = await infoRes.json()
      results.channel_test = {
        channel_id: channelId,
        channel_ok: infoData.ok,
        channel_name: infoData.channel?.name,
        is_member: infoData.channel?.is_member,
        error: infoData.error || undefined,
      }
    } catch (e) {
      results.channel_test = { channel_id: channelId, ok: false, error: String(e) }
    }

    // Test chat.postMessage if ?test_send=1
    const testSend = new URL(request.url).searchParams.get('test_send')
    if (testSend === '1') {
      try {
        const msgRes = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: channelId,
            text: `🔧 Canvi Portal 接続テスト (${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })})`,
            username: 'Canvi Portal',
            icon_emoji: ':white_check_mark:',
          }),
        })
        const msgData = await msgRes.json()
        results.send_test = {
          ok: msgData.ok,
          ts: msgData.ts,
          error: msgData.error || undefined,
          needed: msgData.needed || undefined,
        }
      } catch (e) {
        results.send_test = { ok: false, error: String(e) }
      }
    }
  }

  // Full conversations.list (private + public) — same as fetchSlackChannels
  const fullList = new URL(request.url).searchParams.get('full_list')
  if (fullList === '1' && botToken) {
    try {
      const flRes = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200', {
        headers: { Authorization: `Bearer ${botToken}` },
      })
      const flData = await flRes.json()
      results.full_channel_list = {
        ok: flData.ok,
        total: flData.channels?.length ?? 0,
        error: flData.error || undefined,
      }
    } catch (e) {
      results.full_channel_list = { ok: false, error: String(e) }
    }
  }

  return NextResponse.json(results)
}
