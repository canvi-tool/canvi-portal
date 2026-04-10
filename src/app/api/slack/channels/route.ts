import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

interface SlackChannelRaw {
  id: string
  name: string
  is_private: boolean
  is_archived: boolean
  num_members: number
  topic?: { value: string }
  purpose?: { value: string }
}

/**
 * GET /api/slack/channels
 * Slackチャンネル一覧取得（認証済みユーザー全員が読み取り可能）
 *
 * NOTE: slack.ts の fetchSlackChannels を使わず直接 Slack API を呼ぶ。
 * 理由: 特定ルートで process.env が見えなくなるVercel/Next.jsバンドル問題を回避。
 * health/test-notify エンドポイントと同じ直接呼び出しパターンを採用。
 */
export async function GET() {
  try {
    if (DEMO_MODE) {
      return NextResponse.json({
        channels: [
          { id: 'C_DEMO_1', name: 'general', is_private: false, is_archived: false },
          { id: 'C_DEMO_2', name: '勤怠', is_private: false, is_archived: false },
          { id: 'C_DEMO_3', name: 'bpo-001', is_private: false, is_archived: false },
        ],
      })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // 直接 process.env から読み取り（slack.ts経由しない）
    const botToken = process.env.SLACK_BOT_TOKEN
    const tokenExists = !!botToken
    const tokenLen = botToken?.length ?? 0
    const tokenPrefix = botToken?.substring(0, 10) ?? '(unset)'

    console.log(`[slack/channels] GET: user=${user.id}, token_exists=${tokenExists}, len=${tokenLen}, prefix=${tokenPrefix}`)

    if (!botToken) {
      console.error(`[slack/channels] SLACK_BOT_TOKEN is null/undefined. All env keys containing SLACK: ${Object.keys(process.env).filter(k => k.includes('SLACK')).join(', ') || 'NONE'}`)
      return NextResponse.json({
        channels: [],
        error: 'SLACK_BOT_TOKEN is not configured',
        _debug: `token_exists=${tokenExists}, len=${tokenLen}, prefix=${tokenPrefix}, slack_keys=${Object.keys(process.env).filter(k => k.includes('SLACK')).join(',')}`,
      })
    }

    // Slack API を直接呼び出し（fetchSlackChannels を使わない）
    const allChannels: {
      id: string
      name: string
      is_private: boolean
      is_archived: boolean
      num_members?: number
      topic?: string
      purpose?: string
    }[] = []
    let cursor: string | undefined

    do {
      const params = new URLSearchParams({
        types: 'public_channel,private_channel',
        exclude_archived: 'true',
        limit: '200',
      })
      if (cursor) params.set('cursor', cursor)

      const res = await fetch(`https://slack.com/api/conversations.list?${params}`, {
        headers: { Authorization: `Bearer ${botToken}` },
        cache: 'no-store',
      })

      const data = await res.json()
      if (!data.ok) {
        console.error(`[slack/channels] Slack API error: ${data.error}`)
        return NextResponse.json({
          channels: [],
          error: `Slack API error: ${data.error}`,
        }, { status: 500 })
      }

      for (const ch of (data.channels || []) as SlackChannelRaw[]) {
        allChannels.push({
          id: ch.id,
          name: ch.name,
          is_private: ch.is_private,
          is_archived: ch.is_archived,
          num_members: ch.num_members,
          topic: ch.topic?.value,
          purpose: ch.purpose?.value,
        })
      }

      cursor = data.response_metadata?.next_cursor
    } while (cursor && allChannels.length < 500)

    allChannels.sort((a, b) => a.name.localeCompare(b.name))
    console.log(`[slack/channels] OK: ${allChannels.length} channels fetched directly`)
    return NextResponse.json({ channels: allChannels })
  } catch (error) {
    console.error('GET /api/slack/channels error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

/**
 * POST /api/slack/channels
 * Slackチャンネル新規作成（管理者のみ）
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || (!isOwner(user) && !isAdmin(user))) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await request.json()
    const { name, is_private } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'チャンネル名を入力してください' }, { status: 400 })
    }

    if (name.trim().length > 80) {
      return NextResponse.json({ error: 'チャンネル名は80文字以内にしてください' }, { status: 400 })
    }

    // POST も直接 Slack API を呼ぶ
    const botToken = process.env.SLACK_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: 'SLACK_BOT_TOKEN is not configured' }, { status: 500 })
    }

    const channelName = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_\u3000-\u9fff\uff00-\uffef]/g, '')

    const res = await fetch('https://slack.com/api/conversations.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${botToken}`,
      },
      body: JSON.stringify({
        name: channelName,
        is_private: !!is_private,
      }),
    })

    const data = await res.json()
    if (!data.ok) {
      const errorMessages: Record<string, string> = {
        'name_taken': 'このチャンネル名は既に使用されています',
        'invalid_name': 'チャンネル名が無効です（英数字・ハイフン・アンダースコアのみ）',
        'no_channel': 'チャンネルの作成に失敗しました',
        'restricted_action': 'Botにチャンネル作成の権限がありません',
        'missing_scope': 'Botにチャンネル作成のスコープ(channels:manage)がありません',
      }
      return NextResponse.json({ error: errorMessages[data.error] || `Slack API error: ${data.error}` }, { status: 400 })
    }

    const ch = data.channel
    return NextResponse.json({
      channel: {
        id: ch.id,
        name: ch.name,
        is_private: ch.is_private,
        is_archived: ch.is_archived,
        num_members: ch.num_members,
        topic: ch.topic?.value,
        purpose: ch.purpose?.value,
      },
    })
  } catch (error) {
    console.error('POST /api/slack/channels error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
