import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendSlackAlert,
  sendProjectNotification,
  buildMissingClockNotification,
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
      report_overdue: { checked: 0, alerted: 0, names: [] as string[] },
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
          delayMinutes: s.attendance_missing_delay_minutes ?? 5,
          repeatIntervalMinutes: s.attendance_missing_repeat_interval_minutes ?? 5,
          maxRepeats: s.attendance_missing_max_repeats ?? 5,
        }])
      )
      const projectIds = notifSettings.map(s => s.project_id)

      // 今日のシフト（対象プロジェクトのみ）を取得
      const { data: todayShifts } = await admin
        .from('shifts')
        .select('id, staff_id, project_id, start_time, end_time, staff:staff_id(last_name, first_name, user_id), project:project_id(id, name, slack_channel_id)')
        .eq('shift_date', today)
        .is('deleted_at', null)
        .in('status', ['APPROVED', 'SUBMITTED'])
        .in('project_id', projectIds)
        // Canviで登録されたシフトのみチェック (Googleカレンダー取込分は除外)
        .is('google_calendar_event_id', null)

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
          entries: Array<{ name: string; startTime: string | null; endTime: string | null }>
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
            entries: [],
            staffIds: [],
            shiftIdsToInsert: [],
            shiftIdsToUpdate: [],
          }

          const staffName = `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明'
          existing.entries.push({
            name: staffName,
            startTime: shift.start_time || null,
            endTime: shift.end_time || null,
          })
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
          if (info.entries.length === 0) continue

          results.missing_clock.alerted += info.entries.length
          results.missing_clock.names.push(...info.entries.map(e => e.name))

          const notification = buildMissingClockNotification(info.entries, today)

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
    // 2. 日報未提出リマインド（PJ設定ベース・繰り返し通知）
    // ========================================
    // report_overdue=true のPJで、退勤済み＋日報未提出のメンバーにSlack通知
    // report_reminder_log テーブルで繰り返し制御

    const { data: reportSettings } = await admin
      .from('project_notification_settings')
      .select('project_id, report_overdue_delay_minutes, report_overdue_repeat_interval_hours, report_overdue_max_repeats')
      .eq('report_overdue', true)

    if (reportSettings && reportSettings.length > 0) {
      const reportSettingsMap = new Map(
        reportSettings.map(s => [s.project_id, {
          delayMinutes: s.report_overdue_delay_minutes ?? 5,
          repeatIntervalHours: s.report_overdue_repeat_interval_hours ?? 4,
          maxRepeats: s.report_overdue_max_repeats ?? 2,
        }])
      )
      const reportProjectIds = reportSettings.map(s => s.project_id)

      // 今日のシフトで退勤済みのスタッフを取得
      const { data: todayShiftsForReport } = await admin
        .from('shifts')
        .select('id, staff_id, project_id, start_time, end_time, staff:staff_id(last_name, first_name, user_id), project:project_id(id, name, slack_channel_id)')
        .eq('shift_date', today)
        .is('deleted_at', null)
        .in('status', ['APPROVED', 'SUBMITTED'])
        .in('project_id', reportProjectIds)
        .is('google_calendar_event_id', null)

      if (todayShiftsForReport && todayShiftsForReport.length > 0) {
        // 退勤済みのレコードを取得（clock_outが設定されている）
        const staffIdsForReport = [...new Set(todayShiftsForReport.map(s => s.staff_id).filter(Boolean))] as string[]
        const { data: clockedOutRecords } = await admin
          .from('attendance_records')
          .select('user_id, staff_id, clock_out')
          .eq('date', today)
          .is('deleted_at', null)
          .not('clock_out', 'is', null)

        const clockedOutMap = new Map<string, string>() // staff_id → clock_out timestamp
        for (const a of (clockedOutRecords || []) as Array<{ user_id: string; staff_id: string | null; clock_out: string | null }>) {
          if (a.staff_id && a.clock_out) {
            clockedOutMap.set(a.staff_id, a.clock_out)
          }
        }

        // 日報提出済みのスタッフを取得
        const { data: todayReportsForCheck } = await admin
          .from('work_reports')
          .select('staff_id')
          .eq('report_date', today)
          .is('deleted_at', null)
          .in('staff_id', staffIdsForReport)

        const reportedStaffIds = new Set((todayReportsForCheck || []).map(r => r.staff_id).filter(Boolean))

        // 既存リマインドログを取得
        const { data: existingReminders } = await admin
          .from('report_reminder_log')
          .select('staff_id, project_id, alert_count, last_alerted_at')
          .eq('shift_date', today)
          .in('staff_id', staffIdsForReport)

        const reminderLogMap = new Map<string, { alertCount: number; lastAlertedAt: Date }>()
        for (const r of (existingReminders || []) as Array<{ staff_id: string; project_id: string; alert_count: number; last_alerted_at: string }>) {
          reminderLogMap.set(`${r.staff_id}:${r.project_id}`, {
            alertCount: r.alert_count,
            lastAlertedAt: new Date(r.last_alerted_at),
          })
        }

        // PJ別にリマインド対象をグループ化
        const reportAlertsByProject = new Map<string, {
          projectName: string
          slackChannelId: string | null
          entries: Array<{ name: string; staffId: string }>
          toInsert: Array<{ staffId: string; projectId: string }>
          toUpdate: Array<{ staffId: string; projectId: string; newCount: number }>
        }>()

        for (const shift of todayShiftsForReport) {
          results.report_overdue.checked++
          const staff = shift.staff as unknown as { last_name: string; first_name: string; user_id: string } | null
          const project = shift.project as unknown as { id: string; name: string; slack_channel_id: string | null } | null

          if (!staff || !shift.staff_id || !shift.project_id) continue

          // 日報提出済みならスキップ
          if (reportedStaffIds.has(shift.staff_id)) continue

          // 退勤していなければスキップ（まだ勤務中）
          const clockOutTime = clockedOutMap.get(shift.staff_id)
          if (!clockOutTime) continue

          const settings = reportSettingsMap.get(shift.project_id)
          if (!settings) continue

          // 退勤時刻 + delay_minutes が経過しているかチェック
          const clockOutDate = new Date(clockOutTime)
          const minutesSinceClockOut = Math.floor((now.getTime() - clockOutDate.getTime()) / 60000)
          if (minutesSinceClockOut < settings.delayMinutes) continue

          // リマインドログを確認
          const logKey = `${shift.staff_id}:${shift.project_id}`
          const existingLog = reminderLogMap.get(logKey)

          if (existingLog) {
            // 最大回数送信済みならスキップ
            if (existingLog.alertCount >= settings.maxRepeats) continue

            // 前回アラートからの経過時間（時間）でチェック
            const hoursSinceLastAlert = (now.getTime() - existingLog.lastAlertedAt.getTime()) / (60 * 60 * 1000)
            if (hoursSinceLastAlert < settings.repeatIntervalHours) continue
          }

          // アラート対象として追加
          const projectId = project?.id || '__no_project__'
          const existing = reportAlertsByProject.get(projectId) || {
            projectName: project?.name || '未割当',
            slackChannelId: project?.slack_channel_id || null,
            entries: [],
            toInsert: [],
            toUpdate: [],
          }

          const staffName = `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明'
          existing.entries.push({ name: staffName, staffId: shift.staff_id })

          if (existingLog) {
            existing.toUpdate.push({ staffId: shift.staff_id, projectId: shift.project_id, newCount: existingLog.alertCount + 1 })
          } else {
            existing.toInsert.push({ staffId: shift.staff_id, projectId: shift.project_id })
          }

          reportAlertsByProject.set(projectId, existing)
        }

        // PJ別にリマインド通知送信 + ログ更新
        for (const [projectId, info] of reportAlertsByProject) {
          if (info.entries.length === 0) continue

          results.report_overdue.alerted += info.entries.length
          results.report_overdue.names.push(...info.entries.map(e => e.name))

          const nameList = info.entries.map(e => `• ${e.name}`).join('\n')
          const notification = {
            text: `:memo: *日報未提出リマインド*\n${today} の日報が未提出です:\n${nameList}\n\n退勤済みですが日報が提出されていません。提出をお願いします。`,
          }

          if (info.slackChannelId) {
            await sendProjectNotification(notification, info.slackChannelId, {
              projectId: projectId !== '__no_project__' ? projectId : null,
              staffId: info.entries.map(e => e.staffId),
            })
          } else {
            await sendSlackAlert(notification)
          }

          // 新規ログ挿入
          if (info.toInsert.length > 0) {
            const rows = info.toInsert.map(item => ({
              staff_id: item.staffId,
              project_id: item.projectId,
              shift_date: today,
              alert_count: 1,
              last_alerted_at: now.toISOString(),
            }))
            await admin.from('report_reminder_log').upsert(rows, { onConflict: 'staff_id,project_id,shift_date' })
          }

          // 既存ログ更新
          for (const item of info.toUpdate) {
            await admin
              .from('report_reminder_log')
              .update({
                alert_count: item.newCount,
                last_alerted_at: now.toISOString(),
              })
              .eq('staff_id', item.staffId)
              .eq('project_id', item.projectId)
              .eq('shift_date', today)
          }
        }
      }
    }

    // ========================================
    // 3. 残業警告: Slack通知は無効化（ユーザー要望により停止）
    // ========================================
    // 過去に「あほみたいに通知が来る」との指摘があり、残業警告のSlack通知は完全停止。
    // 必要であれば管理画面で個別に勤務時間を確認すること。

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
