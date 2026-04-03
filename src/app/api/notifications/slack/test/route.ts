import { NextResponse } from 'next/server'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'
import { sendSlackMessage, buildGeneralAlertNotification } from '@/lib/integrations/slack'

// Slack通知テスト送信（オーナーのみ）
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user || !isOwner(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const message = buildGeneralAlertNotification(
      'テスト通知',
      'Canvi PortalからのSlack連携テストです。この通知が表示されていれば連携は正常です。',
      'info'
    )

    const result = await sendSlackMessage(message)

    if (result.success) {
      return NextResponse.json({ success: true, message: 'テスト通知を送信しました' })
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }
  } catch (error) {
    console.error('Slack test error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
