import { NextRequest, NextResponse } from 'next/server'
import {
  resetPassword,
  GoogleWorkspaceError,
} from '@/lib/integrations/google-workspace'

/**
 * POST /api/integrations/google-workspace/users/[email]/reset-password
 * パスワードをリセット
 * Body (optional): { newPassword?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params
    const decodedEmail = decodeURIComponent(email)

    let newPassword: string | undefined
    try {
      const body = await request.json()
      newPassword = body.newPassword
    } catch {
      // Body is optional; if parsing fails, auto-generate password
    }

    const result = await resetPassword(decodedEmail, newPassword)

    return NextResponse.json({
      message: `${decodedEmail} のパスワードをリセットしました`,
      temporaryPassword: result.password,
    })
  } catch (err) {
    console.error('Google Workspace resetPassword error:', err)
    if (err instanceof GoogleWorkspaceError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode || 500 }
      )
    }
    return NextResponse.json(
      { error: 'パスワードのリセットに失敗しました' },
      { status: 500 }
    )
  }
}
