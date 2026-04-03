import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'
import { sendEmail, buildWelcomeLoginEmail } from '@/lib/email/send'

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
    const { user_ids } = body as { user_ids?: string[] }

    const admin = createAdminClient()

    // 対象ユーザーを取得
    let query = admin.from('users').select('id, email, display_name').order('display_name')
    if (user_ids && user_ids.length > 0) {
      query = query.in('id', user_ids)
    }
    const { data: users, error: usersError } = await query

    if (usersError || !users || users.length === 0) {
      return NextResponse.json({ error: '対象ユーザーが見つかりません' }, { status: 400 })
    }

    // 自分自身は除外
    const targets = users.filter(u => u.id !== currentUser.id)

    const loginUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
      : 'https://canvi-portal.vercel.app/login'

    const results: { user_id: string; display_name: string; email: string; success: boolean; error?: string }[] = []

    for (const user of targets) {
      try {
        // 新しい初期パスワードを生成してリセット
        const newPassword = generateInitialPassword()

        const { error: updateError } = await admin.auth.admin.updateUserById(
          user.id,
          {
            password: newPassword,
            user_metadata: { needs_password_setup: true },
          }
        )

        if (updateError) {
          results.push({
            user_id: user.id,
            display_name: user.display_name,
            email: user.email,
            success: false,
            error: `パスワードリセット失敗: ${updateError.message}`,
          })
          continue
        }

        // メール送信
        const emailContent = buildWelcomeLoginEmail({
          displayName: user.display_name,
          email: user.email,
          initialPassword: newPassword,
          loginUrl,
        })

        await sendEmail({
          to: user.email,
          subject: emailContent.subject,
          html: emailContent.html,
        })

        results.push({
          user_id: user.id,
          display_name: user.display_name,
          email: user.email,
          success: true,
        })
      } catch (err) {
        results.push({
          user_id: user.id,
          display_name: user.display_name,
          email: user.email,
          success: false,
          error: err instanceof Error ? err.message : 'メール送信に失敗しました',
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      message: `${successCount}名に送信完了${failCount > 0 ? `、${failCount}名失敗` : ''}`,
      results,
      success_count: successCount,
      fail_count: failCount,
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
