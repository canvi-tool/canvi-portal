import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'
import { attendanceModifySchema } from '@/lib/validations/attendance'
import {
  sendProjectNotification,
  buildClockOutNotification,
  buildBreakStartNotification,
  buildBreakEndNotification,
} from '@/lib/integrations/slack'

interface RouteParams {
  params: Promise<{ id: string }>
}

// 退勤打刻 / 休憩開始・終了 / 打刻修正
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()
    const body = await request.json()
    const action = body.action as string // 'clock_out' | 'break_start' | 'break_end' | 'modify'

    // 対象レコード取得
    const { data: record, error: fetchError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !record) {
      return NextResponse.json({ error: '打刻記録が見つかりません' }, { status: 404 })
    }

    // 権限チェック: 自分のレコードか管理者か
    if (record.user_id !== user.id && !isOwner(user) && !isAdmin(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const now = new Date().toISOString()

    switch (action) {
      case 'clock_out': {
        if (record.status === 'clocked_out') {
          return NextResponse.json({ error: '既に退勤済みです' }, { status: 409 })
        }

        // 勤務時間計算
        const clockIn = new Date(record.clock_in!)
        const clockOut = new Date(now)
        const totalMinutes = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000)
        const breakMinutes = record.break_minutes || 0
        const workMinutes = Math.max(0, totalMinutes - breakMinutes)

        // 残業計算（8時間=480分超過分）
        const overtimeMinutes = Math.max(0, workMinutes - 480)

        const { data, error } = await supabase
          .from('attendance_records')
          .update({
            clock_out: now,
            work_minutes: workMinutes,
            overtime_minutes: overtimeMinutes,
            status: 'clocked_out',
          })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Slack通知（退勤） - プロジェクトの通知設定を確認してから送信
        let projectSlackChannelId: string | null = null
        let projectName: string | undefined
        if (record.project_id) {
          const { data: proj } = await supabase
            .from('projects')
            .select('slack_channel_id, name')
            .eq('id', record.project_id)
            .single()
          projectSlackChannelId = proj?.slack_channel_id || null
          projectName = proj?.name || undefined
        }
        const staffName = user.displayName || user.email || 'メンバー'
        const hours = Math.floor(workMinutes / 60)
        const mins = workMinutes % 60
        // 通知設定に関わらず送信（スレッド内に統合するため）
        sendProjectNotification(
          buildClockOutNotification(staffName, `${hours}h ${mins}m`, undefined, projectName),
          projectSlackChannelId,
          {
            ...(record.slack_thread_ts ? { thread_ts: record.slack_thread_ts } : {}),
            projectId: record.project_id,
            staffId: record.staff_id,
          }
        ).catch(() => {})

        return NextResponse.json(data)
      }

      case 'break_start': {
        if (record.status !== 'clocked_in') {
          return NextResponse.json({ error: '勤務中でないため休憩開始できません' }, { status: 409 })
        }

        const { data, error } = await supabase
          .from('attendance_records')
          .update({
            break_start: now,
            status: 'on_break',
          })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Slack通知（休憩開始） - スレッド内に統合
        {
          let breakChannelId: string | null = null
          if (record.project_id) {
            const { data: proj } = await supabase
              .from('projects')
              .select('slack_channel_id')
              .eq('id', record.project_id)
              .single()
            breakChannelId = proj?.slack_channel_id || null
          }
          const breakStaffName = user.displayName || user.email || 'メンバー'
          sendProjectNotification(
            buildBreakStartNotification(breakStaffName),
            breakChannelId,
            {
              ...(record.slack_thread_ts ? { thread_ts: record.slack_thread_ts } : {}),
              projectId: record.project_id,
              staffId: record.staff_id,
            }
          ).catch(() => {})
        }

        return NextResponse.json(data)
      }

      case 'break_end': {
        if (record.status !== 'on_break') {
          return NextResponse.json({ error: '休憩中でないため休憩終了できません' }, { status: 409 })
        }

        // 休憩時間を加算
        const breakStart = new Date(record.break_start!)
        const breakEnd = new Date(now)
        const additionalBreakMinutes = Math.round((breakEnd.getTime() - breakStart.getTime()) / 60000)
        const totalBreakMinutes = (record.break_minutes || 0) + additionalBreakMinutes

        const { data, error } = await supabase
          .from('attendance_records')
          .update({
            break_end: now,
            break_minutes: totalBreakMinutes,
            status: 'clocked_in',
          })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Slack通知（休憩終了） - スレッド内に統合
        {
          let breakEndChannelId: string | null = null
          if (record.project_id) {
            const { data: proj } = await supabase
              .from('projects')
              .select('slack_channel_id')
              .eq('id', record.project_id)
              .single()
            breakEndChannelId = proj?.slack_channel_id || null
          }
          const breakEndStaffName = user.displayName || user.email || 'メンバー'
          sendProjectNotification(
            buildBreakEndNotification(breakEndStaffName, additionalBreakMinutes),
            breakEndChannelId,
            {
              ...(record.slack_thread_ts ? { thread_ts: record.slack_thread_ts } : {}),
              projectId: record.project_id,
              staffId: record.staff_id,
            }
          ).catch(() => {})
        }

        return NextResponse.json(data)
      }

      case 'modify': {
        // 管理者のみ修正可能
        if (!isOwner(user) && !isAdmin(user)) {
          return NextResponse.json({ error: '修正は管理者のみ可能です' }, { status: 403 })
        }

        const parsed = attendanceModifySchema.safeParse(body)
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'バリデーションエラー', details: parsed.error.flatten() },
            { status: 400 }
          )
        }

        const updateData: Record<string, unknown> = {
          modified_by: user.id,
          modification_reason: parsed.data.modification_reason,
          status: 'modified',
        }

        if (parsed.data.clock_in) updateData.clock_in = parsed.data.clock_in
        if (parsed.data.clock_out) {
          updateData.clock_out = parsed.data.clock_out
          // 勤務時間再計算
          const ci = new Date(parsed.data.clock_in || record.clock_in!)
          const co = new Date(parsed.data.clock_out)
          const totalMin = Math.round((co.getTime() - ci.getTime()) / 60000)
          const breakMin = parsed.data.break_minutes ?? record.break_minutes ?? 0
          updateData.work_minutes = Math.max(0, totalMin - breakMin)
          updateData.overtime_minutes = Math.max(0, (updateData.work_minutes as number) - 480)
        }
        if (parsed.data.break_minutes !== undefined) updateData.break_minutes = parsed.data.break_minutes
        if (parsed.data.project_id) updateData.project_id = parsed.data.project_id
        if (parsed.data.location_type) updateData.location_type = parsed.data.location_type
        if (parsed.data.note !== undefined) updateData.note = parsed.data.note

        const { data, error } = await supabase
          .from('attendance_records')
          .update(updateData)
          .eq('id', id)
          .select()
          .single()

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        return NextResponse.json(data)
      }

      default:
        return NextResponse.json({ error: '不正なアクションです' }, { status: 400 })
    }
  } catch (error) {
    console.error('PUT /api/attendance/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

// 打刻承認（管理者用）
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user || (!isOwner(user) && !isAdmin(user))) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const supabase = await createServerSupabaseClient()
    const body = await request.json()
    const action = body.action as string // 'approve'

    if (action !== 'approve') {
      return NextResponse.json({ error: '不正なアクションです' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .update({ status: 'approved' })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('POST /api/attendance/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
