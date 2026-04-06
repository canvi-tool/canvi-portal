import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendProjectNotification,
  buildShiftAttendanceDiffNotification,
} from '@/lib/integrations/slack'

/**
 * シフトvs打刻の乖離チェック Cron Job (Phase 3)
 *
 * 毎日 20:00 JST に実行 (vercel.json: "0 11 * * *" = UTC 11:00 = JST 20:00)
 * 丸め後 (clock_in_rounded / clock_out_rounded) の打刻と シフト時刻を比較し、
 * 1分以上の乖離をプロジェクトチャンネルに通知。
 * 丸め適用範囲 (±10分) を超えた打刻のみが通知対象となる。
 */
export async function GET(request: NextRequest) {
  // Cron認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // JSTで今日の日付
  const now = new Date()
  const jstOffset = 9 * 60 * 60 * 1000
  const jstNow = new Date(now.getTime() + jstOffset)
  const today = jstNow.toISOString().split('T')[0]

  const DIFF_THRESHOLD_MINUTES = 1

  const results = {
    checked: 0,
    mismatched: 0,
    errors: 0,
    details: [] as { staffName: string; project: string; diffMinutes: number }[],
  }

  try {
    // 今日のシフトを取得
    const { data: todayShifts } = await admin
      .from('shifts')
      .select('id, staff_id, project_id, start_time, end_time, staff:staff_id(id, last_name, first_name, user_id), project:project_id(id, name, slack_channel_id)')
      .eq('shift_date', today)
      .is('deleted_at', null)
      .in('status', ['APPROVED', 'SUBMITTED'])

    if (!todayShifts || todayShifts.length === 0) {
      return NextResponse.json({
        success: true,
        date: today,
        message: '今日のシフトがありません',
        results,
      })
    }

    // 今日の打刻を取得 (丸め後の値を優先して使用)
    const { data: todayAttendance } = await admin
      .from('attendance_records')
      .select('user_id, staff_id, project_id, clock_in, clock_out, clock_in_rounded, clock_out_rounded')
      .eq('date', today)
      .is('deleted_at', null)
      .not('clock_in', 'is', null)

    // staff_id + project_id -> attendance マップ
    // 比較は丸め後の値で行う (fallback: 生値)
    const attendanceMap = new Map<string, { clock_in: string; clock_out: string | null }>()
    for (const att of (todayAttendance || []) as Array<{
      staff_id: string | null
      project_id: string | null
      clock_in: string
      clock_out: string | null
      clock_in_rounded: string | null
      clock_out_rounded: string | null
    }>) {
      if (!att.clock_in) continue
      const key = `${att.staff_id}__${att.project_id || ''}`
      attendanceMap.set(key, {
        clock_in: att.clock_in_rounded || att.clock_in,
        clock_out: att.clock_out_rounded || att.clock_out,
      })
    }

    // プロジェクト別にグループ化
    const diffsByProject = new Map<string, {
      projectName: string
      slackChannelId: string | null
      entries: { staffName: string; shiftTime: string; actualTime: string; diffMinutes: number }[]
      staffIds: string[]
    }>()

    for (const shift of todayShifts) {
      results.checked++
      const staff = shift.staff as unknown as { id: string; last_name: string; first_name: string; user_id: string } | null
      const project = shift.project as unknown as { id: string; name: string; slack_channel_id: string | null } | null

      if (!staff || !shift.start_time) continue

      const staffName = `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明'
      const attKey = `${shift.staff_id}__${shift.project_id || ''}`
      const attendance = attendanceMap.get(attKey)

      if (!attendance) continue // 打刻なし -> attendance-alerts で処理済み

      // シフト開始 vs 実際の出勤を比較
      const shiftStartMinutes = timeToMinutes(shift.start_time)
      const clockInJst = toJstMinutes(attendance.clock_in, jstOffset)
      const clockInDiff = Math.abs(clockInJst - shiftStartMinutes)

      // シフト終了 vs 実際の退勤を比較
      let clockOutDiff = 0
      if (shift.end_time && attendance.clock_out) {
        const shiftEndMinutes = timeToMinutes(shift.end_time)
        const clockOutJst = toJstMinutes(attendance.clock_out, jstOffset)
        clockOutDiff = Math.abs(clockOutJst - shiftEndMinutes)
      }

      const maxDiff = Math.max(clockInDiff, clockOutDiff)
      if (maxDiff < DIFF_THRESHOLD_MINUTES) continue

      results.mismatched++

      const shiftTimeStr = `${shift.start_time.slice(0, 5)}~${shift.end_time ? shift.end_time.slice(0, 5) : '?'}`
      const clockInStr = formatJstTime(attendance.clock_in, jstOffset)
      const clockOutStr = attendance.clock_out ? formatJstTime(attendance.clock_out, jstOffset) : '未退勤'
      const actualTimeStr = `${clockInStr}~${clockOutStr}`

      results.details.push({ staffName, project: project?.name || '未割当', diffMinutes: maxDiff })

      const projectId = project?.id || '__no_project__'
      const existing = diffsByProject.get(projectId) || {
        projectName: project?.name || '未割当',
        slackChannelId: project?.slack_channel_id || null,
        entries: [],
        staffIds: [],
      }
      existing.entries.push({ staffName, shiftTime: shiftTimeStr, actualTime: actualTimeStr, diffMinutes: maxDiff })
      if (shift.staff_id) existing.staffIds.push(shift.staff_id)
      diffsByProject.set(projectId, existing)
    }

    // プロジェクト別にSlack通知
    for (const [projectId, info] of diffsByProject) {
      if (info.entries.length === 0) continue

      try {
        const notification = buildShiftAttendanceDiffNotification(info.entries, today, info.projectName)

        if (info.slackChannelId) {
          await sendProjectNotification(notification, info.slackChannelId, {
            projectId: projectId !== '__no_project__' ? projectId : null,
            staffId: info.staffIds,
          })
        }
      } catch (err) {
        console.error(`[shift-attendance-diff] notification error for project ${info.projectName}:`, err)
        results.errors++
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      results,
    })
  } catch (error) {
    console.error('[shift-attendance-diff] Cron error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

/** HH:MM:SS -> minutes since midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** ISO timestamp -> JST minutes since midnight */
function toJstMinutes(isoString: string, jstOffset: number): number {
  const date = new Date(isoString)
  const jst = new Date(date.getTime() + jstOffset)
  return jst.getUTCHours() * 60 + jst.getUTCMinutes()
}

/** ISO timestamp -> HH:MM (JST) */
function formatJstTime(isoString: string, jstOffset: number): string {
  const date = new Date(isoString)
  const jst = new Date(date.getTime() + jstOffset)
  return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`
}
