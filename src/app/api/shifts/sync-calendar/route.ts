import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncShiftToCalendar } from '@/lib/integrations/google-calendar-sync'

/**
 * POST /api/shifts/sync-calendar
 * 未同期の承認済みシフトをGoogleカレンダーに一括同期
 * 管理者以上のみ実行可能
 */
export async function POST() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || (!currentUser.roles.includes('owner') && !currentUser.roles.includes('admin'))) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const admin = createAdminClient()

    // 未同期の承認済み・提出済みシフトを取得
    const { data: shifts } = await admin
      .from('shifts')
      .select('id')
      .in('status', ['APPROVED', 'SUBMITTED'])
      .is('deleted_at', null)
      .or('google_calendar_synced.is.null,google_calendar_synced.eq.false')
      .limit(50)

    if (!shifts?.length) {
      return NextResponse.json({ message: '同期対象のシフトがありません', synced: 0, errors: 0 })
    }

    let synced = 0
    let errors = 0
    const errorDetails: string[] = []

    for (const shift of shifts) {
      try {
        await syncShiftToCalendar(shift.id)
        synced++
      } catch (e) {
        errors++
        errorDetails.push(`${shift.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    return NextResponse.json({
      message: `${synced}件同期完了、${errors}件エラー`,
      synced,
      errors,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    })
  } catch (error) {
    console.error('POST /api/shifts/sync-calendar error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
