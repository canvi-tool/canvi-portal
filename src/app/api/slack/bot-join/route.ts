import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { initUsergroupSync } from '@/lib/integrations/slack'

// Vercel上で応答後も処理を継続させる
function after(fn: () => Promise<unknown>) {
  try {
    waitUntil(fn().catch((e) => console.error('[bot-join after] task error:', e)))
  } catch {
    fn().catch((e) => console.error('[bot-join after-fallback] task error:', e))
  }
}

/**
 * env var → DB fallback でBot Tokenを取得
 */
async function resolveSlackBotToken(): Promise<string | null> {
  const envToken = process.env.SLACK_BOT_TOKEN
  if (envToken) return envToken

  console.warn('[bot-join] process.env.SLACK_BOT_TOKEN is null. Trying DB fallback...')
  try {
    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('system_settings')
      .select('value')
      .eq('key', 'SLACK_BOT_TOKEN')
      .single()
    const val = (data as { value: string } | null)?.value
    if (val) {
      console.log(`[bot-join] Got SLACK_BOT_TOKEN from DB (len=${val.length})`)
      return val
    }
  } catch (err) {
    console.error('[bot-join] DB fallback failed:', err)
  }
  return null
}

/**
 * POST /api/slack/bot-join
 * Botを指定チャンネルに参加させる（管理者の明示的な操作のみ）
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || (!isOwner(user) && !isAdmin(user))) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { channelId } = await request.json()
    if (!channelId) {
      return NextResponse.json({ error: 'チャンネルIDが必要です' }, { status: 400 })
    }

    const token = await resolveSlackBotToken()
    if (!token) {
      return NextResponse.json({ error: 'SLACK_BOT_TOKENが未設定です（env + DB both failed）' }, { status: 500 })
    }

    // conversations.join でBotをチャンネルに参加させる
    const res = await fetch('https://slack.com/api/conversations.join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ channel: channelId }),
    })

    const data = await res.json()

    if (!data.ok) {
      const errorMessages: Record<string, string> = {
        'channel_not_found': 'チャンネルが見つかりません',
        'is_archived': 'アーカイブ済みチャンネルには参加できません',
        'method_not_supported_for_channel_type': 'このチャンネルタイプには参加できません（プライベートチャンネルの場合はSlack上で /invite してください）',
        'missing_scope': 'Botに channels:join スコープがありません',
        'not_authed': 'Bot Tokenが無効です',
      }
      return NextResponse.json({
        error: errorMessages[data.error] || `Slack API error: ${data.error}`,
      }, { status: 400 })
    }

    // Bot参加成功 → プロジェクトに紐付くチャンネルならユーザーグループ同期をバックグラウンドで実行
    const joinedChannelId = data.channel?.id || channelId
    after(async () => {
      await initUsergroupSync(joinedChannelId)
    })

    return NextResponse.json({
      success: true,
      channel: {
        id: data.channel?.id,
        name: data.channel?.name,
      },
    })
  } catch (error) {
    console.error('POST /api/slack/bot-join error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

/**
 * GET /api/slack/bot-join?channelId=xxx
 * Botが指定チャンネルに参加済みか確認
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const channelId = new URL(request.url).searchParams.get('channelId')
    if (!channelId) {
      return NextResponse.json({ error: 'channelIdが必要です' }, { status: 400 })
    }

    const token = await resolveSlackBotToken()
    if (!token) {
      return NextResponse.json({ isMember: false, error: 'SLACK_BOT_TOKENが未設定（env + DB both failed）' })
    }

    // conversations.info でBot参加状態を確認
    const res = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const data = await res.json()

    if (!data.ok) {
      return NextResponse.json({ isMember: false, error: data.error })
    }

    return NextResponse.json({
      isMember: data.channel?.is_member === true,
      channelName: data.channel?.name,
    })
  } catch (error) {
    console.error('GET /api/slack/bot-join error:', error)
    return NextResponse.json({ isMember: false, error: 'サーバーエラー' })
  }
}
