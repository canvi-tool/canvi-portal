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
 *
 * 5分ごとに実行し、以下をチェック:
 * 1. 打刻漏れ検知（リアルタイム）
 *    - シフト開始時刻 + delay_minutes 経過後にアラート
 *    - repeat_interval_minutes 間隔で最大 max_repeats 回まで繰り返し
 *    - attendance_alert_log テーブルで送信済み回数を追跡
 * 2. 残業警告
 *    - 勤務時間10時間超のメンバーに警告
 */
export async function GET(request: NextRequest) {
  // Cron認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()

    // JSTで現在時刻を取得
    const now = new Date()
    const jstOffset = 9 * 60 * 60 * 1000
    const jstNow = new Date(now.getTime() + jstOffset)
    const today = jstNow.toISOString().split('T')[0]
    // JST現在時刻を分単位で計算（0:00 からの経過分数）
    const jstHours = jstNow.getUTCHours()
    const jstMinutes = jstNow.getUTCMinutes()
    const nowMinutesSinceMidnight = jstHours * 60 + jstMinutes

    const results = {
      missing_clock: { checked: 0, alerted: 0, names: [] as string[] },
      overtime: { checked: 0, alerted: 0, names: [] as string[] },
    }

    // ========================================
    // 1. 打刻漏れチェック（リアルタイム）
    // ========================================

    // attendance_missing=true のプロジェクト設定を取得
    const { data: notifSettings } = await admin
      .from('project_notification_settings')
      .select('project_id, attendance_missing_delay_minutes, attendance_missing_repeat_interval_minutes, attendance_missing_max_repeats')
      .eq('attendance_missing', true)

    if (notifSettings && notifSettings.length > 0) {
      // 設定をMapに変換
      const settingsMap = new Map(
        notifSettings.map(s => [s.project_id, {
          delayMinutes: s.attendance_missing_delay_minutes ?? 15,
          repeatIntervalMinutes: s.attendance_missing_repeat_interval_minutes ?? 30,
          maxRepeats: s.attendance_missing_max_repeats ?? 3,
        }])
      )
      const projectIds = notifSettings.map(s => s.project_id)

      // 今日のシフト（対象プロジェクトのみ）を取得
      const { data: todayShifts } = await admin
        .from('shifts')
        .select('id, staff_id, project_id, start_time, staff:staff_id(last_name, first_name, user_id), project:project_id(id, name, slack_channel_id)')
        .eq('shift_date', today)
        .is('deleted_at', null)
        .in('status', ['APPROVED', 'SUBMITTED'])
        .in('project_id', projectIds)

      if (todayShifts && todayShifts.length > 0) {
        // 打刻済みのuser_idを取得
        const { data: todayAttendance } = await admin
          .from('attendance_records')
          .select('user_id')
          .eq('date', today)
          .is('deleted_at', null)
          .not('clock_in', 'is', null)

        const clockedUserIds = new Set((todayAttendance || []).map(a => a.user_id))

        // 今日のシフトに対する既存アラートログを取得
        const shiftIds = todayShifts.map(s => s.id).filter(Boolean)
        const { data: existingAlerts } = await admin
          .from('attendance_alert_log')
          .select('shift_id, alert_count, last_alerted_at')
          .in('shift_id', shiftIds)

        const alertLogMap = new Map(
          (existingAlerts || []).map(a => [a.shift_id, {
            alertCount: a.alert_count,
            lastAlertedAt: new Date(a.last_alerted_at),
          }])
        )

        // PJ別にアラート対象をグループ化
        const alertsByProject = new Map<string, {
          projectName: string
          slackChannelId: string | null
          names: string[]
          staffIds: string[]
          shiftIdsToInsert: string[]
          shiftIdsToUpdate: string[]
        }>()

        for (const shift of todayShifts) {
          results.missing_clock.checked++
          const staff = shift.staff as unknown as { last_name: string; first_name: string; user_id: string } | null
          const project = shift.project as unknown as { id: string; name: string; slack_channel_id: string | null } | null

          if (!staff?.user_id || !shift.start_time || !shift.project_id) continue

          // 既に打刻済みならスキップ
          if (clockedUserIds.has(staff.user_id)) continue

          const settings = settingsMap.get(shift.project_id)
          if (!settings) continue

          // シフト開始時刻を分に変換 (HH:MM:SS -> minutes since midnight)
          const [h, m] = shift.start_time.split(':').map(Number)
          const shiftStartMinutes = h * 60 + m

          // シフト開始 + delay_minutes が現在時刻を過ぎているかチェック
          const firstAlertMinutes = shiftStartMinutes + settings.delayMinutes
          if (nowMinutesSinceMidnight < firstAlertMinutes) continue

          // アラートログを確認
          const existingLog = alertLogMap.get(shift.id)

          if (existingLog) {
            // 既に最大回数送信済みならスキップ
            if (existingLog.alertCount >= settings.maxRepeats) continue

            // 前回アラートからの実経過時間（分）でチェック
            const minutesSinceLastAlert = Math.floor(
              (now.getTime() - existingLog.lastAlertedAt.getTime()) / 60000
            )

            if (minutesSinceLastAlert < settings.repeatIntervalMinutes) continue
          }

          // アラート対象として追加
          const projectId = project?.id || '__no_project__'
          const existing = alertsByProject.get(projectId) || {
            projectName: project?.name || '未割当',
            slackChannelId: project?.slack_channel_id || null,
            names: [],
            staffIds: [],
            shiftIdsToInsert: [],
            shiftIdsToUpdate: [],
          }

          const staffName = `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明'
          existing.names.push(staffName)
          if (shift.staff_id) existing.staffIds.push(shift.staff_id)

          if (existingLog) {
            existing.shiftIdsToUpdate.push(shift.id)
          } else {
            existing.shiftIdsToInsert.push(shift.id)
          }

          alertsByProject.set(projectId, existing)
        }

        // PJ別に通知送信 + アラートログ更新
        for (const [projectId, info] of alertsByProject) {
          if (info.names.length === 0) continue

          results.missing_clock.alerted += info.names.length
          results.missing_clock.names.push(...info.names)

          const notification = buildMissingClockNotification(info.names, today)

          if (info.slackChannelId) {
            await sendProjectNotification(notification, info.slackChannelId, {
              projectId: projectId !== '__no_project__' ? projectId : null,
              staffId: info.staffIds.length > 0 ? info.staffIds : null,
            })
          } else {
            await sendSlackAlert(notification)
          }

          // 新規アラートログを挿入
          if (info.shiftIdsToInsert.length > 0) {
            const rows = info.shiftIdsToInsert.map(shiftId => {
              const shift = todayShifts.find(s => s.id === shiftId)
              return {
                shift_id: shiftId,
                project_id: shift?.project_id || projectId,
                staff_id: shift?.staff_id || '',
                alert_count: 1,
                last_alerted_at: now.toISOString(),
              }
            })
            await admin.from('attendance_alert_log').insert(rows)
          }

          // 既存アラートログを更新（alert_count + 1, last_alerted_at 更新）
          for (const shiftId of info.shiftIdsToUpdate) {
            const existing = alertLogMap.get(shiftId)
            if (existing) {
              await admin
                .from('attendance_alert_log')
                .update({
                  alert_count: existing.alertCount + 1,
                  last_alerted_at: now.toISOString(),
                })
                .eq('shift_id', shiftId)
            }
          }
        }
      }
    }

    // ========================================
    // 2. 残業警告: 勤務時間10時間超 → PJ別チャンネルに送信
    // ========================================
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
      jstTime: `${String(jstHours).padStart(2, '0')}:${String(jstMinutes).padStart(2, '0')}`,
      results,
    })
  } catch (error) {
    console.error('Attendance check cron error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
