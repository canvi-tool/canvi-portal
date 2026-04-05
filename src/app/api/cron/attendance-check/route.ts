import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendSlackAlert,
  sendProjectNotification,
  buildMissingClockNotification,
  buildOvertimeWarningNotification,
} from '@/lib/integrations/slack'

/**
 * 勤怠チェック Cron Job
 * - シフトありだが打刻なし（打刻漏れ検知） → PJ別Slackチャンネルに通知
 * - 勤務時間10時間超の残業警告 → PJ別Slackチャンネルに通知
 *
 * 毎日 22:00 JST (13:00 UTC) に実行
 */
export async function GET(request: NextRequest) {
  // Cron認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()

    // JSTで今日の日付
    const now = new Date()
    const jstOffset = 9 * 60 * 60 * 1000
    const jstDate = new Date(now.getTime() + jstOffset)
    const today = jstDate.toISOString().split('T')[0]

    const results = {
      missing_clock: { checked: 0, alerted: 0, names: [] as string[] },
      overtime: { checked: 0, alerted: 0, names: [] as string[] },
    }

    // 1. 打刻漏れチェック: 今日シフトがあるが打刻がないメンバー
    // PJ別にグループ化してそれぞれのチャンネルに送信
    const { data: todayShifts } = await admin
      .from('shifts')
      .select('staff_id, project_id, staff:staff_id(last_name, first_name, user_id), project:project_id(id, name, slack_channel_id)')
      .eq('shift_date', today)
      .is('deleted_at', null)
      .in('status', ['APPROVED', 'SUBMITTED'])

    if (todayShifts && todayShifts.length > 0) {
      // 打刻済みのuser_idを取得
      const { data: todayAttendance } = await admin
        .from('attendance_records')
        .select('user_id')
        .eq('date', today)
        .is('deleted_at', null)

      const clockedUserIds = new Set((todayAttendance || []).map(a => a.user_id))

      // PJ別に打刻漏れメンバーをグループ化
      const missingByProject = new Map<string, {
        projectName: string
        slackChannelId: string | null
        names: string[]
        staffIds: string[]
      }>()

      for (const shift of todayShifts) {
        results.missing_clock.checked++
        const staff = shift.staff as unknown as { last_name: string; first_name: string; user_id: string } | null
        const project = shift.project as unknown as { id: string; name: string; slack_channel_id: string | null } | null

        if (staff?.user_id && !clockedUserIds.has(staff.user_id)) {
          const projectId = project?.id || '__no_project__'
          const existing = missingByProject.get(projectId) || {
            projectName: project?.name || '未割当',
            slackChannelId: project?.slack_channel_id || null,
            names: [],
            staffIds: [],
          }
          const staffName = `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明'
          existing.names.push(staffName)
          if (shift.staff_id) existing.staffIds.push(shift.staff_id)
          missingByProject.set(projectId, existing)
        }
      }

      // PJ別に通知送信
      for (const [projectId, info] of missingByProject) {
        if (info.names.length > 0) {
          results.missing_clock.alerted += info.names.length
          results.missing_clock.names.push(...info.names)

          const notification = buildMissingClockNotification(info.names, today)
          if (info.slackChannelId) {
            // PJ紐付けチャンネルに送信（管理者+本人メンション付き）
            await sendProjectNotification(notification, info.slackChannelId, {
              projectId: projectId !== '__no_project__' ? projectId : null,
              staffId: info.staffIds.length > 0 ? info.staffIds : null,
            })
          } else {
            // デフォルトアラートチャンネルに送信
            await sendSlackAlert(notification)
          }
        }
      }
    }

    // 2. 残業警告: 勤務時間10時間超 → PJ別チャンネルに送信
    const { data: longWorkRecords } = await admin
      .from('attendance_records')
      .select('user_id, staff_id, work_minutes, project_id, staff:staff_id(last_name, first_name), project:project_id(slack_channel_id)')
      .eq('date', today)
      .is('deleted_at', null)
      .gt('work_minutes', 600)

    if (longWorkRecords) {
      for (const rec of longWorkRecords) {
        results.overtime.checked++
        const staff = rec.staff as unknown as { last_name: string; first_name: string } | null
        const project = rec.project as unknown as { slack_channel_id: string | null } | null
        const name = staff ? `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明' : '不明'
        const hours = Math.round((rec.work_minutes || 0) / 60 * 10) / 10
        results.overtime.alerted++
        results.overtime.names.push(name)

        const notification = buildOvertimeWarningNotification(name, hours, today)
        if (project?.slack_channel_id) {
          await sendProjectNotification(notification, project.slack_channel_id, {
            projectId: rec.project_id,
            staffId: rec.staff_id,
          })
        } else {
          await sendSlackAlert(notification)
        }
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      results,
    })
  } catch (error) {
    console.error('Attendance check cron error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
