import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/slack/health/test-notify?channel=CHANNEL_ID
 * 通知パスの各ステップをテスト（認証不要・テスト用）
 * sendProjectNotification と同じフローを再現して、どこで失敗するかを特定する
 */
export async function GET(request: NextRequest) {
  const channelId = new URL(request.url).searchParams.get('channel')
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  }

  // Step 1: Check env vars
  const botToken = process.env.SLACK_BOT_TOKEN
  const defaultChannel = process.env.SLACK_DEFAULT_CHANNEL_ID
  results.step1_env = {
    SLACK_BOT_TOKEN_set: !!botToken,
    SLACK_BOT_TOKEN_length: botToken?.length ?? 0,
    SLACK_BOT_TOKEN_prefix: botToken?.substring(0, 10) ?? '(unset)',
    SLACK_DEFAULT_CHANNEL_ID: defaultChannel || '(unset)',
    SLACK_WEBHOOK_URL_set: !!process.env.SLACK_WEBHOOK_URL,
    target_channel: channelId || defaultChannel || '(none)',
  }

  const targetChannel = channelId || defaultChannel
  if (!targetChannel) {
    results.error = 'No channel specified. Use ?channel=CHANNEL_ID'
    return NextResponse.json(results)
  }

  if (!botToken) {
    results.error = 'SLACK_BOT_TOKEN is not set'
    return NextResponse.json(results)
  }

  // Step 2: Test auth.test
  try {
    const authRes = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
    const authData = await authRes.json()
    results.step2_auth = { ok: authData.ok, user: authData.user, error: authData.error }
  } catch (e) {
    results.step2_auth = { ok: false, error: String(e) }
  }

  // Step 3: Test conversations.info (channel membership)
  try {
    const infoRes = await fetch(`https://slack.com/api/conversations.info?channel=${targetChannel}`, {
      headers: { Authorization: `Bearer ${botToken}` },
    })
    const infoData = await infoRes.json()
    results.step3_channel = {
      ok: infoData.ok,
      name: infoData.channel?.name,
      is_member: infoData.channel?.is_member,
      is_archived: infoData.channel?.is_archived,
      error: infoData.error,
    }
  } catch (e) {
    results.step3_channel = { ok: false, error: String(e) }
  }

  // Step 4: Test chat.postMessage (actual send)
  try {
    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    const msgRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: targetChannel,
        text: `🔧 Canvi通知テスト (${now})`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🔧 通知パステスト*\nこのメッセージが見えれば通知機能は正常です\n\`${now}\``,
            },
          },
        ],
        username: 'Canvi Portal',
        icon_emoji: ':white_check_mark:',
      }),
    })
    const msgData = await msgRes.json()
    results.step4_send = {
      ok: msgData.ok,
      ts: msgData.ts,
      channel: msgData.channel,
      error: msgData.error,
      needed: msgData.needed, // Shows required scopes if missing
      response_metadata: msgData.response_metadata, // Additional error info
    }
  } catch (e) {
    results.step4_send = { ok: false, error: String(e) }
  }

  // Step 5: Test getBotToken() import path
  // Import and test the actual function used by sendProjectNotification
  try {
    const { sendSlackBotMessage } = await import('@/lib/integrations/slack')
    const testResult = await sendSlackBotMessage(targetChannel, {
      text: `🔧 sendSlackBotMessage テスト (${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })})`,
    })
    results.step5_sendSlackBotMessage = {
      success: testResult.success,
      ts: testResult.ts,
      error: testResult.error,
    }
  } catch (e) {
    results.step5_sendSlackBotMessage = { ok: false, error: String(e) }
  }

  return NextResponse.json(results)
}
