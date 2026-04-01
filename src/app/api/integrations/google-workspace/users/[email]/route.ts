import { NextRequest, NextResponse } from 'next/server'
import {
  getUser,
  updateUser,
  suspendUser,
  unsuspendUser,
  deleteUser,
  GoogleWorkspaceError,
} from '@/lib/integrations/google-workspace'

/**
 * GET /api/integrations/google-workspace/users/[email]
 * ユーザー詳細を取得
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params
    const decodedEmail = decodeURIComponent(email)

    const user = await getUser(decodedEmail)

    return NextResponse.json({ user })
  } catch (err) {
    console.error('Google Workspace getUser error:', err)
    if (err instanceof GoogleWorkspaceError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode || 500 }
      )
    }
    return NextResponse.json(
      { error: 'ユーザー情報の取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/integrations/google-workspace/users/[email]
 * ユーザーの停止/再有効化
 * Body: { action: 'suspend' | 'unsuspend' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params
    const decodedEmail = decodeURIComponent(email)
    const body = await request.json()

    const { action, givenName, familyName, orgUnitPath, password, changePasswordAtNextLogin } = body

    if (action === 'update') {
      const user = await updateUser(decodedEmail, { givenName, familyName, orgUnitPath, password, changePasswordAtNextLogin })
      return NextResponse.json({ user })
    }

    if (action !== 'suspend' && action !== 'unsuspend') {
      return NextResponse.json(
        { error: 'action は "suspend", "unsuspend", "update" のいずれかを指定してください' },
        { status: 400 }
      )
    }

    const user =
      action === 'suspend'
        ? await suspendUser(decodedEmail)
        : await unsuspendUser(decodedEmail)

    return NextResponse.json({ user })
  } catch (err) {
    console.error('Google Workspace updateUser error:', err)
    if (err instanceof GoogleWorkspaceError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode || 500 }
      )
    }
    return NextResponse.json(
      { error: 'ユーザーの更新に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/integrations/google-workspace/users/[email]
 * ユーザーを削除
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params
    const decodedEmail = decodeURIComponent(email)

    await deleteUser(decodedEmail)

    return NextResponse.json({ message: `${decodedEmail} を削除しました` })
  } catch (err) {
    console.error('Google Workspace deleteUser error:', err)
    if (err instanceof GoogleWorkspaceError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode || 500 }
      )
    }
    return NextResponse.json(
      { error: 'ユーザーの削除に失敗しました' },
      { status: 500 }
    )
  }
}
