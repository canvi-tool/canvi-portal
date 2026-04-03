import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'
import { clockInSchema } from '@/lib/validations/attendance'
import { sendSlackMessage, buildClockInNotification } from '@/lib/integrations/slack'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// 打刻一覧取得
export async function GET(request: NextRequest) {
  try {
    if (DEMO_MODE) {
      return NextResponse.json({ data: [], total: 0 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staff_id')
    const userId = searchParams.get('user_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const projectId = searchParams.get('project_id')
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '50')

    let query = supabase
      .from('attendance_records')
      .select('*, staff:staff_id(id, display_name), project:project_id(id, name, project_code)', { count: 'exact' })
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .order('clock_in', { ascending: false })

    // スタッフは自分のレコードのみ
    if (!isOwner(user) && !isAdmin(user)) {
      query = query.eq('user_id', user.id)
    } else {
      // 管理者はフィルタ可能
      if (staffId) query = query.eq('staff_id', staffId)
      if (userId) query = query.eq('user_id', userId)
    }

    if (dateFrom) query = query.gte('date', dateFrom)
    if (dateTo) query = query.lte('date', dateTo)
    if (projectId) query = query.eq('project_id', projectId)

    // ページネーション
    const from = (page - 1) * perPage
    query = query.range(from, from + perPage - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('GET /api/attendance error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('GET /api/attendance error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

// 出勤打刻
export async function POST(request: NextRequest) {
  try {
    if (DEMO_MODE) {
      return NextResponse.json({
        id: 'demo-attendance-1',
        status: 'clocked_in',
        clock_in: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
      }, { status: 201 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = clockInSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    // 今日既に出勤打刻済みか確認（同じPJの場合）
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('date', today)
      .is('deleted_at', null)
      .in('status', ['clocked_in', 'on_break'])
      .limit(1)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: '既に出勤打刻済みです。退勤してから再度打刻してください。' },
        { status: 409 }
      )
    }

    // staff_idを取得
    const { data: staffRecord } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        user_id: user.id,
        staff_id: staffRecord?.id || null,
        project_id: parsed.data.project_id || null,
        date: today,
        clock_in: now,
        status: 'clocked_in',
        location_type: parsed.data.location_type || null,
        note: parsed.data.note || null,
      })
      .select()
      .single()

    if (error) {
      console.error('POST /api/attendance error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Slack通知（非同期・失敗してもエラーにしない）
    const staffName = user.displayName || user.email || 'メンバー'
    sendSlackMessage(buildClockInNotification(staffName)).catch(() => {})

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/attendance error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
