/**
 * POST /api/shifts/gcal-import
 * Phase 1: Googleカレンダー primary → Canvi shifts 取込（PJ未割当で投入）
 *
 * Body: { start_date?: string, end_date?: string }
 * デフォルト: 今日から30日後
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncFromGoogleCalendarForStaff } from '@/lib/integrations/google-calendar-import'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const admin = createAdminClient()

    const { data: staffRecord } = await admin
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!staffRecord) {
      return NextResponse.json({ error: 'スタッフ情報がありません' }, { status: 404 })
    }

    const jstOffset = 9 * 60 * 60 * 1000
    const jstNow = new Date(Date.now() + jstOffset)
    const startDate = body.start_date || jstNow.toISOString().split('T')[0]
    const defaultEnd = new Date(jstNow.getTime() + 30 * 24 * 60 * 60 * 1000)
    const endDate = body.end_date || defaultEnd.toISOString().split('T')[0]

    const timeMin = `${startDate}T00:00:00+09:00`
    const timeMax = `${endDate}T23:59:59+09:00`

    const result = await syncFromGoogleCalendarForStaff({
      staffId: staffRecord.id as string,
      userId: user.id,
      timeMin,
      timeMax,
    })

    return NextResponse.json({
      message: `取込完了: ${result.created}件新規, ${result.updated}件更新, ${result.skipped}件スキップ`,
      ...result,
    })
  } catch (error) {
    console.error('POST /api/shifts/gcal-import error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
