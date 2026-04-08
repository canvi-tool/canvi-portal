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
import { isManagerOrOwner, getCurrentUser } from '@/lib/auth/rbac'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const admin = createAdminClient()

    const jstOffset = 9 * 60 * 60 * 1000
    const jstNow = new Date(Date.now() + jstOffset)
    const startDate = body.start_date || jstNow.toISOString().split('T')[0]
    const defaultEnd = new Date(jstNow.getTime() + 30 * 24 * 60 * 60 * 1000)
    const endDate = body.end_date || defaultEnd.toISOString().split('T')[0]

    const timeMin = `${startDate}T00:00:00+09:00`
    const timeMax = `${endDate}T23:59:59+09:00`

    // staff_ids が指定されている場合は管理者のみ複数スタッフ取込可
    const requestedStaffIds: string[] = Array.isArray(body.staff_ids) ? body.staff_ids.filter(Boolean) : []

    if (requestedStaffIds.length > 0) {
      // 管理者チェック
      const me = await getCurrentUser()
      if (!me || !isManagerOrOwner(me)) {
        return NextResponse.json({ error: '管理者のみ実行できます' }, { status: 403 })
      }

      const { data: staffs } = await admin
        .from('staff')
        .select('id, user_id')
        .in('id', requestedStaffIds)
        .eq('status', 'active')

      const targets = (staffs || []).filter(s => !!s.user_id)
      const results = await Promise.allSettled(
        targets.map(s =>
          syncFromGoogleCalendarForStaff({
            staffId: s.id as string,
            userId: s.user_id as string,
            timeMin,
            timeMax,
          })
        )
      )
      let created = 0, updated = 0, skipped = 0
      for (const r of results) {
        if (r.status === 'fulfilled') {
          created += r.value.created || 0
          updated += r.value.updated || 0
          skipped += r.value.skipped || 0
        }
      }
      return NextResponse.json({
        message: `${targets.length}名取込: ${created}件新規, ${updated}件更新, ${skipped}件スキップ`,
        created, updated, skipped,
      })
    }

    // 単独取込（自分）
    const { data: staffRecord } = await admin
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!staffRecord) {
      return NextResponse.json({ error: 'スタッフ情報がありません' }, { status: 404 })
    }

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
