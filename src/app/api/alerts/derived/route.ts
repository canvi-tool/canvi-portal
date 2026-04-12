import { NextRequest, NextResponse } from 'next/server'
import { getProjectAccess } from '@/lib/auth/project-access'
import { getRecentDerivedAlerts } from '@/lib/alerts/recent-alerts'

/**
 * GET /api/alerts/derived
 * 派生アラート（勤怠エラー/日報未提出/差戻し等）をロールスコープで取得
 * ?include_ignored=1 で無視ルール適用前の全アラートを返す
 */
export async function GET(request: NextRequest) {
  try {
    const { user, allowedProjectIds } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeIgnored = searchParams.get('include_ignored') === '1'

    const alerts = await getRecentDerivedAlerts(user, allowedProjectIds, {
      limit: 50,
      lookbackDays: 14,
      skipIgnoreFilter: includeIgnored,
    })

    return NextResponse.json(alerts)
  } catch (error) {
    console.error('GET /api/alerts/derived error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
