import { NextResponse } from 'next/server'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'
import { fetchSlackChannels } from '@/lib/integrations/slack'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

/**
 * GET /api/slack/channels
 * Slackチャンネル一覧取得（管理者のみ）
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
    if (!user || (!isOwner(user) && !isAdmin(user))) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const result = await fetchSlackChannels()

    if (result.error) {
      return NextResponse.json(
        { channels: [], error: result.error },
        { status: result.error.includes('not configured') ? 200 : 500 }
      )
    }

    return NextResponse.json({ channels: result.channels })
  } catch (error) {
    console.error('GET /api/slack/channels error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
