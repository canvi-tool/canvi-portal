import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'

/** 初期パスワードを生成: Canvi + ランダム4桁 + ca */
function generateInitialPassword(): string {
  const digits = String(Math.floor(1000 + Math.random() * 9000))
  return `Canvi${digits}ca`
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || !isOwner(currentUser)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await request.json()
    const { user_id } = body as { user_id: string }

    if (!user_id) {
      return NextResponse.json({ error: 'user_id は必須です' }, { status: 400 })
    }

    // 自分自身のパスワードはリセットさせない（セキュリティ）
    if (user_id === currentUser.id) {
      return NextResponse.json({ error: '自分自身のパスワードはこの画面からリセットできません' }, { status: 400 })
    }

    const admin = createAdminClient()
    const newPassword = generateInitialPassword()

    const { error: updateError } = await admin.auth.admin.updateUserById(
      user_id,
      {
        password: newPassword,
        user_metadata: { needs_password_setup: true },
      }
    )

    if (updateError) {
      return NextResponse.json(
        { error: `パスワードリセットに失敗しました: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      new_password: newPassword,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    return NextResponse.json(
      { error: '予期しないエラーが発生しました' },
      { status: 500 }
    )
  }
}
