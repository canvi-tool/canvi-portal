import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/rbac'
import {
  sendProjectNotification,
  buildClockInNotification,
  buildClockOutNotification,
} from '@/lib/integrations/slack'
import { embedSlackThreadTs, extractSlackThreadTs } from '@/lib/utils/slack-thread'
import { notifyIfDailyReportMissing } from '@/lib/notifications/daily-report-check'
import { applyShiftRounding } from '@/lib/attendance/rounding'

/**
 * 一括出勤 / 一括退勤
 * action='clock_in': 自分がアサインされている全アクティブPJのうち、まだ出勤していないPJに一括出勤
 * action='clock_out': 現在勤務中(clocked_in/on_break)の全レコードを一括退勤
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const action = body.action as 'clock_in' | 'clock_out'
    if (action !== 'clock_in' && action !== 'clock_out') {
      return NextResponse.json({ error: '不正なactionです' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const now_jst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
    const today = now_jst.toISOString().split('T')[0]
    const now = new Date().toISOString()

    // staff_idと名前を取得
    const { data: staffRecord } = await supabase
      .from('staff')
      .select('id, last_name, first_name')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    const staffName = (staffRecord?.last_name || staffRecord?.first_name ? `${staffRecord.last_name || ''} ${staffRecord.first_name || ''}`.trim() : null) || user.displayName || 'メンバー'
    const created: unknown[] = []
    const updated: unknown[] = []

    if (action === 'clock_in') {
      // アサインされているactive projectsを取得
      let projectIds: string[] = (body.project_ids as string[]) || []
      if (projectIds.length === 0) {
        // staff_id経由でアサイン取得
        if (!staffRecord?.id) {
          return NextResponse.json({ error: 'staffレコードが見つかりません' }, { status: 404 })
        }
        const { data: assigns } = await supabase
          .from('project_assignments')
          .select('project_id, project:project_id(id, status)')
          .eq('staff_id', staffRecord.id)
          .eq('status', 'active')
          .is('deleted_at', null)
        projectIds = (assigns || [])
          .map(a => a.project_id)
          .filter(Boolean) as string[]
      }

      if (projectIds.length === 0) {
        return NextResponse.json({ error: 'アサインPJがありません' }, { status: 409 })
      }

      // 既に勤務中のPJを除外
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('project_id')
        .eq('user_id', user.id)
        .eq('date', today)
        .is('deleted_at', null)
        .in('status', ['clocked_in', 'on_break'])
        .in('project_id', projectIds)

      const activeSet = new Set((existing || []).map(e => e.project_id))
      const targetProjects = projectIds.filter(p => !activeSet.has(p))

      if (targetProjects.length === 0) {
        return NextResponse.json({ error: '全PJで既に勤務中です', count: 0 }, { status: 409 })
      }

      // 各PJに対して出勤レコードを作成
      for (const projectId of targetProjects) {
        // シフト取得して打刻丸め
        let clockInRounded: string | null = null
        let roundingApplied = false
        if (staffRecord?.id) {
          const shiftQuery = supabase
            .from('shifts')
            .select('start_time')
            .eq('staff_id', staffRecord.id)
            .eq('shift_date', today)
            .is('deleted_at', null)
            .in('status', ['APPROVED', 'SUBMITTED'])
            .eq('project_id', projectId)
            .limit(1)
          const { data: shiftRow } = await shiftQuery.maybeSingle()
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
            project_id: projectId,
            date: today,
            clock_in: now,
            clock_in_rounded: clockInRounded,
            rounding_applied: roundingApplied,
            status: 'clocked_in',
            location_type: 'remote',
          })
          .select()
          .single()

        if (error || !data) continue
        created.push(data)

        // Slack通知
        try {
          const { data: proj } = await supabase
            .from('projects')
            .select('slack_channel_id, name')
            .eq('id', projectId)
            .single()
          const result = await sendProjectNotification(
            buildClockInNotification(staffName, proj?.name),
            proj?.slack_channel_id || null,
            { projectId, staffId: staffRecord?.id }
          )
          if (result.ts && data.id) {
            const adminSupabase = createAdminClient()
            const newNote = embedSlackThreadTs(data.note, result.ts)
            await adminSupabase
              .from('attendance_records')
              .update({ note: newNote })
              .eq('id', data.id)
          }
        } catch (err) {
          console.error('[bulk-clock-in] Slack通知エラー:', err)
        }
      }

      return NextResponse.json({ count: created.length, records: created })
    } else {
      // clock_out: 現在勤務中の全レコードを退勤
      const { data: activeRecords } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .is('deleted_at', null)
        .in('status', ['clocked_in', 'on_break'])

      if (!activeRecords || activeRecords.length === 0) {
        return NextResponse.json({ error: '勤務中のレコードがありません' }, { status: 409 })
      }

      for (const record of activeRecords) {
        // 休憩中なら先に休憩終了
        let totalBreak = record.break_minutes || 0
        if (record.status === 'on_break' && record.break_start) {
          const additional = Math.round(
            (new Date(now).getTime() - new Date(record.break_start).getTime()) / 60000
          )
          totalBreak += additional
        }

        // シフト取得して退勤丸め
        let clockOutRounded: string | null = null
        let roundingAppliedOut = false
        if (record.staff_id && record.project_id) {
          const { data: shiftRow } = await supabase
            .from('shifts')
            .select('end_time')
            .eq('staff_id', record.staff_id)
            .eq('shift_date', record.date)
            .is('deleted_at', null)
            .in('status', ['APPROVED', 'SUBMITTED'])
            .eq('project_id', record.project_id)
            .limit(1)
            .maybeSingle()
          if (shiftRow?.end_time) {
            const res = applyShiftRounding(now, record.date, shiftRow.end_time)
            clockOutRounded = res.rounded
            if (res.applied) roundingAppliedOut = true
          }
        }

        // 勤務時間計算: 丸め後の値を正として使用
        const clockInForCalc = new Date(record.clock_in_rounded || record.clock_in!)
        const clockOutForCalc = new Date(clockOutRounded || now)
        const totalMinutes = Math.round((clockOutForCalc.getTime() - clockInForCalc.getTime()) / 60000)
        const workMinutes = Math.max(0, totalMinutes - totalBreak)
        const overtimeMinutes = Math.max(0, workMinutes - 480)

        const updates: Record<string, unknown> = {
          clock_out: now,
          clock_out_rounded: clockOutRounded,
          rounding_applied: record.rounding_applied || roundingAppliedOut,
          status: 'clocked_out',
          break_minutes: totalBreak,
          work_minutes: workMinutes,
          overtime_minutes: overtimeMinutes,
        }
        if (record.status === 'on_break') {
          updates.break_end = now
        }

        const { data, error } = await supabase
          .from('attendance_records')
          .update(updates)
          .eq('id', record.id)
          .select()
          .single()

        if (error || !data) continue
        updated.push(data)

        // Slack通知
        try {
          let channelId: string | null = null
          let projectName: string | undefined
          if (record.project_id) {
            const { data: proj } = await supabase
              .from('projects')
              .select('slack_channel_id, name')
              .eq('id', record.project_id)
              .single()
            channelId = proj?.slack_channel_id || null
            projectName = proj?.name
          }
          const threadTs = extractSlackThreadTs(record.note)
          const workHours = `${Math.floor(workMinutes / 60)}h${workMinutes % 60}m`
          await sendProjectNotification(
            buildClockOutNotification(staffName, workHours, undefined, projectName),
            channelId,
            {
              ...(threadTs ? { thread_ts: threadTs } : {}),
              projectId: record.project_id,
              staffId: record.staff_id,
            }
          )
        } catch (err) {
          console.error('[bulk-clock-out] Slack通知エラー:', err)
        }
      }

      // 日報提出チェック → 未提出なら本人のみ Slack DM (staff_id+date でdedupe)
      try {
        const seen = new Set<string>()
        for (const rec of updated as Array<{ staff_id?: string | null; date?: string | null }>) {
          if (!rec?.staff_id || !rec?.date) continue
          const key = `${rec.staff_id}:${rec.date}`
          if (seen.has(key)) continue
          seen.add(key)
          await notifyIfDailyReportMissing(rec.staff_id, rec.date, (rec as { project_id?: string | null }).project_id)
        }
      } catch (err) {
        console.error('[bulk-clock-out] daily-report-check error:', err)
      }

      return NextResponse.json({ count: updated.length, records: updated })
    }
  } catch (error) {
    console.error('POST /api/attendance/bulk error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
