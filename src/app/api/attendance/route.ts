import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'
import { clockInSchema } from '@/lib/validations/attendance'
import { sendProjectNotification, buildClockInNotification } from '@/lib/integrations/slack'
import { embedSlackThreadTs } from '@/lib/utils/slack-thread'
import { applyShiftRounding } from '@/lib/attendance/rounding'

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
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '50')

    let query = supabase
      .from('attendance_records')
      .select('*, staff:staff_id(id, last_name, first_name), project:project_id(id, name, project_code)', { count: 'exact' })
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
    if (status) query = query.eq('status', status as 'clocked_in' | 'on_break' | 'clocked_out' | 'modified' | 'approved')

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
    const now_jst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
    const today = now_jst.toISOString().split('T')[0]
    const now = new Date().toISOString()

    // 今日既に出勤打刻済みか確認（同じプロジェクトの場合のみ重複エラー）
    // 複数プロジェクトにアサインされているスタッフは、プロジェクトごとに打刻可能
    let duplicateQuery = supabase
      .from('attendance_records')
      .select('id, status, project_id')
      .eq('user_id', user.id)
      .eq('date', today)
      .is('deleted_at', null)
      .in('status', ['clocked_in', 'on_break'])

    if (parsed.data.project_id) {
      // プロジェクト指定ありの場合：同じプロジェクトで未退勤のものがあるかチェック
      duplicateQuery = duplicateQuery.eq('project_id', parsed.data.project_id)
    } else {
      // プロジェクト未指定の場合：プロジェクト未指定の未退勤レコードがあるかチェック
      duplicateQuery = duplicateQuery.is('project_id', null)
    }

    const { data: existing } = await duplicateQuery.limit(1).single()

    if (existing) {
      return NextResponse.json(
        { error: 'このプロジェクトでは既に出勤打刻済みです。退勤してから再度打刻してください。' },
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

    // シフト時刻を取得して打刻を丸める (Phase 3)
    let clockInRounded: string = now
    let roundingApplied = false
    if (staffRecord?.id) {
      const shiftQuery = supabase
        .from('shifts')
        .select('start_time')
        .eq('staff_id', staffRecord.id)
        .eq('shift_date', today)
        .is('deleted_at', null)
        .in('status', ['APPROVED', 'SUBMITTED'])
        .limit(1)
      const { data: shiftRow } = parsed.data.project_id
        ? await shiftQuery.eq('project_id', parsed.data.project_id).maybeSingle()
        : await shiftQuery.maybeSingle()
      if (shiftRow?.start_time) {
        const res = applyShiftRounding(now, today, shiftRow.start_time)
        clockInRounded = res.rounded
        roundingApplied = res.applied
      }
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        user_id: user.id,
        staff_id: staffRecord?.id || null,
        project_id: parsed.data.project_id || null,
        date: today,
        clock_in: now,
        clock_in_rounded: clockInRounded,
        rounding_applied: roundingApplied,
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
    // プロジェクトの通知設定を確認してから送信
    let projectSlackChannelId: string | null = null
    let projectName: string | undefined
    const projectId = parsed.data.project_id || null
    if (projectId) {
      const { data: proj } = await supabase
        .from('projects')
        .select('slack_channel_id, name')
        .eq('id', projectId)
        .single()
      projectSlackChannelId = proj?.slack_channel_id || null
      projectName = proj?.name
    }
    const staffName = user.displayName || user.email || 'メンバー'
    // 出勤通知を送信し、thread_tsをnoteフィールドに埋め込む（後続打刻をスレッドにまとめるため）
    try {
      const result = await sendProjectNotification(
        buildClockInNotification(staffName, projectName),
        projectSlackChannelId,
        { projectId, staffId: staffRecord?.id }
      )
      console.log(`[thread] clock-in result: success=${result.success}, ts=${result.ts}, id=${data?.id}`)
      if (result.ts && data?.id) {
        // noteフィールドにthread_tsを埋め込み保存（admin clientでRLSバイパス）
        const adminSupabase = createAdminClient()
        const newNote = embedSlackThreadTs(data.note, result.ts)
        const { error: updateErr } = await adminSupabase
          .from('attendance_records')
          .update({ note: newNote })
          .eq('id', data.id)
        if (updateErr) {
          console.error(`[thread] thread_ts save FAILED: ${updateErr.message}`)
        } else {
          console.log(`[thread] thread_ts saved in note: ${result.ts}`)
        }
      }
    } catch (err) {
      console.error('[thread] clock-in notification error:', err)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/attendance error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
