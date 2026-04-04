import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

/**
 * 今日の自分の打刻状態を取得
 * 複数プロジェクトでの打刻に対応（プロジェクトごとのレコードを全て返す）
 */
export async function GET() {
  try {
    if (DEMO_MODE) {
      return NextResponse.json({ records: [], status: 'not_clocked_in' })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()

    // JSTで今日の日付を取得
    const now = new Date()
    const jstOffset = 9 * 60 * 60 * 1000
    const jstDate = new Date(now.getTime() + jstOffset)
    const today = jstDate.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('attendance_records')
      .select('*, project:project_id(id, name, project_code)')
      .eq('user_id', user.id)
      .eq('date', today)
      .is('deleted_at', null)
      .order('clock_in', { ascending: false })

    if (error) {
      console.error('GET /api/attendance/today error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const records = data || []

    // 後方互換: record（最新1件）とstatus
    // 全体のステータスは、いずれかが勤務中/休憩中なら活性
    const activeRecord = records.find(
      (r) => r.status === 'clocked_in' || r.status === 'on_break'
    )
    const latestRecord = records[0] || null
    const overallStatus = activeRecord
      ? activeRecord.status
      : latestRecord
        ? latestRecord.status === 'clocked_out' ? 'clocked_out' : latestRecord.status
        : 'not_clocked_in'

    return NextResponse.json({
      // 後方互換
      record: activeRecord || latestRecord,
      status: overallStatus,
      // 新: 全レコード
      records,
    })
  } catch (error) {
    console.error('GET /api/attendance/today error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
