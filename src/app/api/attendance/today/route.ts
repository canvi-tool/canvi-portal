import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// 今日の自分の打刻状態を取得
export async function GET() {
  try {
    if (DEMO_MODE) {
      return NextResponse.json({ record: null, status: 'not_clocked_in' })
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
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('GET /api/attendance/today error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ record: null, status: 'not_clocked_in' })
    }

    return NextResponse.json({
      record: data,
      status: data.status,
    })
  } catch (error) {
    console.error('GET /api/attendance/today error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
