import { NextResponse } from 'next/server'
import {
  listGroups,
  GoogleWorkspaceError,
} from '@/lib/integrations/google-workspace'

const DOMAIN = process.env.GOOGLE_WORKSPACE_DOMAIN || 'canvi.co.jp'

/**
 * GET /api/integrations/google-workspace/groups
 * グループ一覧を取得
 */
export async function GET() {
  try {
    const groups = await listGroups(DOMAIN)

    return NextResponse.json({ groups })
  } catch (err) {
    console.error('Google Workspace listGroups error:', err)
    if (err instanceof GoogleWorkspaceError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode || 500 }
      )
    }
    return NextResponse.json(
      { error: 'グループ一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}
