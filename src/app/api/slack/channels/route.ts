import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

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
 * env var → DB fallback でBot Tokenを取得
 */
async function resolveSlackBotToken(): Promise<string | null> {
  // 1. process.env を試す
  const envToken = process.env.SLACK_BOT_TOKEN
  if (envToken) return envToken

  // 2. DB fallback (system_settings テーブル)
  console.warn('[slack/channels] process.env.SLACK_BOT_TOKEN is null. Trying DB fallback...')
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
      console.log(`[slack/channels] Got SLACK_BOT_TOKEN from DB (len=${val.length})`)
      return val
    }
  } catch (err) {
    console.error('[slack/channels] DB fallback failed:', err)
  }
  return null
}

/**
 * GET /api/slack/channels
 * Slackチャンネル一覧取得（認証済みユーザー全員が読み取り可能）
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

    // env var → DB fallback でトークン取得
    const botToken = await resolveSlackBotToken()

    console.log(`[slack/channels] GET: user=${user.id}, token_exists=${!!botToken}, source=${process.env.SLACK_BOT_TOKEN ? 'env' : 'db'}`)

    if (!botToken) {
      return NextResponse.json({
        channels: [],
        error: 'SLACK_BOT_TOKEN is not configured (env + DB both failed)',
        _debug: `env_token=false, db_fallback=failed`,
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

    // POST も env → DB fallback でトークン取得
    const botToken = await resolveSlackBotToken()
    if (!botToken) {
      return NextResponse.json({ error: 'SLACK_BOT_TOKEN is not configured (env + DB both failed)' }, { status: 500 })
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
