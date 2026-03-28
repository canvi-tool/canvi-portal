import { NextRequest, NextResponse } from 'next/server'
import {
  listUsers,
  createUser,
  GoogleWorkspaceError,
} from '@/lib/integrations/google-workspace'

const DOMAIN = process.env.GOOGLE_WORKSPACE_DOMAIN || 'canvi.co.jp'

/**
 * GET /api/integrations/google-workspace/users
 * ユーザー一覧を取得
 * クエリパラメータ: q (検索文字列)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || undefined

    const users = await listUsers(DOMAIN, query)

    return NextResponse.json({ users })
  } catch (err) {
    console.error('Google Workspace listUsers error:', err)
    if (err instanceof GoogleWorkspaceError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode || 500 }
      )
    }
    return NextResponse.json(
      { error: 'ユーザー一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/integrations/google-workspace/users
 * ユーザーを作成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { email, givenName, familyName, password, orgUnitPath } = body

    if (!email || !givenName || !familyName) {
      return NextResponse.json(
        { error: 'email, givenName, familyName は必須です' },
        { status: 400 }
      )
    }

    const user = await createUser({
      email,
      givenName,
      familyName,
      password,
      orgUnitPath,
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (err) {
    console.error('Google Workspace createUser error:', err)
    if (err instanceof GoogleWorkspaceError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode || 500 }
      )
    }
    return NextResponse.json(
      { error: 'ユーザーの作成に失敗しました' },
      { status: 500 }
    )
  }
}
