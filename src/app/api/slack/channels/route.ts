import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'
import { fetchSlackChannels, createSlackChannel } from '@/lib/integrations/slack'

export const dynamic = 'force-dynamic'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

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

    const tokenExists = !!process.env.SLACK_BOT_TOKEN
    const tokenLen = process.env.SLACK_BOT_TOKEN?.length ?? 0
    const tokenPrefix = process.env.SLACK_BOT_TOKEN?.substring(0, 8) ?? '(unset)'
    console.log(`[slack/channels] GET called by user=${user.id}, SLACK_BOT_TOKEN exists=${tokenExists}, len=${tokenLen}, prefix=${tokenPrefix}`)

    const result = await fetchSlackChannels()

    if (result.error) {
      console.error(`[slack/channels] fetchSlackChannels error: ${result.error}`)
      return NextResponse.json(
        {
          channels: [],
          error: result.error,
          _debug: {
            token_exists: tokenExists,
            token_length: tokenLen,
            token_prefix: tokenPrefix,
          },
        },
        { status: result.error.includes('not configured') ? 200 : 500 }
      )
    }

    console.log(`[slack/channels] OK: ${result.channels.length} channels fetched`)
    return NextResponse.json({ channels: result.channels })
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

    const result = await createSlackChannel(name.trim(), !!is_private)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ channel: result.channel })
  } catch (error) {
    console.error('POST /api/slack/channels error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
