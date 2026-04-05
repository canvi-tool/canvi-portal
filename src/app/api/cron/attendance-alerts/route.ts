import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendProjectNotification,
  sendSlackDM,
  resolveStaffSlackUserId,
  buildClockOutMissingDMNotification,
  buildMissingClockNotification,
  buildOvertimeWarningNotification,
} from '@/lib/integrations/slack'

/**
 * 勤怠アラート Cron Job (毎時実行)
 *
 * チェック項目:
 * 1. 退勤漏れ — clocked_in のまま shift.end_time + 30分 超過
 * 2. 打刻漏れ — シフトあるが attendance_records なし
 * 3. 残業超過 — work_minutes > 600 (10時間)
 *
 * 通知先: 本人DM + プロジェクトチャンネル
 */
export async function GET(request: NextRequest) {
  // Cron認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // JSTで現在時刻を取得
  const now = new Date()
  const jstOffset = 9 * 60 * 60 * 1000
  const jstNow = new Date(now.getTime() + jstOffset)
  const today = jstNow.toISOString().split('T')[0]
  const jstHours = jstNow.getUTCHours()
  const jstMinutes = jstNow.getUTCMinutes()
  const nowMinutesSinceMidnight = jstHours * 60 + jstMinutes

  const results = {
    clock_out_missing: { checked: 0, alerted: 0, errors: 0, names: [] as string[] },
    no_attendance: { checked: 0, alerted: 0, errors: 0, names: [] as string[] },
    overtime: { checked: 0, alerted: 0, errors: 0, names: [] as string[] },
  }

  try {
    // ========================================
    // 1. 退勤漏れ: clocked_in のまま shift.end_time + 30分 超過
    // ========================================
    try {
      // 今日 clocked_in のままのレコード
      const { data: clockedInRecords } = await admin
        .from('attendance_records')
        .select('id, user_id, staff_id, project_id, clock_in, staff:staff_id(id, last_name, first_name, email, custom_fields), project:project_id(id, name, slack_channel_id)')
        .eq('date', today)
        .eq('status', 'clocked_in')
        .is('deleted_at', null)
        .is('clock_out', null)

      if (clockedInRecords && clockedInRecords.length > 0) {
        // 対応するシフトを取得して end_time を確認
        const staffIds = clockedInRecords
          .map(r => r.staff_id)
          .filter(Boolean) as string[]

        const { data: todayShifts } = await admin
          .from('shifts')
          .select('staff_id, end_time, project_id')
          .eq('shift_date', today)
          .is('deleted_at', null)
          .in('status', ['APPROVED', 'SUBMITTED'])
          .in('staff_id', staffIds)

        // staff_id + project_id -> end_time マップ
        const shiftEndMap = new Map<string, number>()
        for (const shift of todayShifts || []) {
          if (!shift.end_time || !shift.staff_id) continue
          const [h, m] = shift.end_time.split(':').map(Number)
          const key = `${shift.staff_id}__${shift.project_id || ''}`
          shiftEndMap.set(key, h * 60 + m)
        }

        for (const rec of clockedInRecords) {
          results.clock_out_missing.checked++
          const staff = rec.staff as unknown as { id: string; last_name: string; first_name: string; email: string; custom_fields: Record<string, unknown> } | null
          const project = rec.project as unknown as { id: string; name: string; slack_channel_id: string | null } | null

          if (!staff || !rec.staff_id) continue

          const staffName = `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明'

          // シフト end_time + 30分 を過ぎているかチェック
          const shiftKey = `${rec.staff_id}__${rec.project_id || ''}`
          const endMinutes = shiftEndMap.get(shiftKey)

          // シフトがない場合は clock_in から 10時間経過でアラート
          if (!rec.clock_in) continue
          const clockInTime = new Date(rec.clock_in)
          const clockInJst = new Date(clockInTime.getTime() + jstOffset)
          const clockInMinutes = clockInJst.getUTCHours() * 60 + clockInJst.getUTCMinutes()
          const fallbackThreshold = clockInMinutes + 600 // 10時間

          const threshold = endMinutes != null ? endMinutes + 30 : fallbackThreshold

          if (nowMinutesSinceMidnight < threshold) continue

          try {
            results.clock_out_missing.alerted++
            results.clock_out_missing.names.push(staffName)

            // 本人にDM送信
            const slackUserId = await resolveStaffSlackUserId(rec.staff_id)
            if (slackUserId) {
              await sendSlackDM(
                slackUserId,
                buildClockOutMissingDMNotification(staffName, today, project?.name)
              )
            }

            // プロジェクトチャンネルに通知
            if (project?.slack_channel_id) {
              await sendProjectNotification(
                {
                  text: `【退勤未打刻】${staffName}さんの退勤打刻が未完了です (${today})`,
                  blocks: [
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `:warning: *退勤未打刻* — *${staffName}* さんが出勤中のまま退勤打刻がされていません (${today} / ${project.name})`,
                      },
                    },
                  ],
                },
                project.slack_channel_id,
                { projectId: project.id, staffId: rec.staff_id }
              )
            }
          } catch (err) {
            console.error(`[attendance-alerts] clock_out_missing notification error for ${staffName}:`, err)
            results.clock_out_missing.errors++
          }
        }
      }
    } catch (err) {
      console.error('[attendance-alerts] clock_out_missing check error:', err)
    }

    // ========================================
    // 2. 打刻漏れ: シフトあるが attendance_records なし
    // ========================================
    try {
      // 今日のAPPROVEDシフト（開始時刻 + 30分 が過ぎているもの）
      const { data: todayShifts } = await admin
        .from('shifts')
        .select('id, staff_id, project_id, start_time, end_time, staff:staff_id(id, last_name, first_name, user_id), project:project_id(id, name, slack_channel_id)')
        .eq('shift_date', today)
        .is('deleted_at', null)
        .in('status', ['APPROVED', 'SUBMITTED'])

      if (todayShifts && todayShifts.length > 0) {
        // 今日の打刻済みuser_idを取得
        const { data: todayAttendance } = await admin
          .from('attendance_records')
          .select('user_id, project_id')
          .eq('date', today)
          .is('deleted_at', null)
          .not('clock_in', 'is', null)

        const clockedKeys = new Set(
          (todayAttendance || []).map(a => `${a.user_id}__${a.project_id || ''}`)
        )

        // プロジェクト別にグループ化
        const alertsByProject = new Map<string, {
          projectName: string
          slackChannelId: string | null
          entries: { staffId: string; staffName: string }[]
        }>()

        for (const shift of todayShifts) {
          results.no_attendance.checked++
          const staff = shift.staff as unknown as { id: string; last_name: string; first_name: string; user_id: string } | null
          const project = shift.project as unknown as { id: string; name: string; slack_channel_id: string | null } | null

          if (!staff?.user_id || !shift.start_time) continue

          // 開始時刻 + 30分が過ぎているかチェック
          const [h, m] = shift.start_time.split(':').map(Number)
          const startPlusThreshold = h * 60 + m + 30
          if (nowMinutesSinceMidnight < startPlusThreshold) continue

          // 打刻済みかチェック
          const key = `${staff.user_id}__${shift.project_id || ''}`
          if (clockedKeys.has(key)) continue

          const staffName = `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明'
          results.no_attendance.alerted++
          results.no_attendance.names.push(staffName)

          const projectId = project?.id || '__no_project__'
          const existing = alertsByProject.get(projectId) || {
            projectName: project?.name || '未割当',
            slackChannelId: project?.slack_channel_id || null,
            entries: [],
          }
          existing.entries.push({ staffId: shift.staff_id!, staffName })
          alertsByProject.set(projectId, existing)
        }

        // プロジェクト別に通知
        for (const [projectId, info] of alertsByProject) {
          try {
            const staffNames = info.entries.map(e => e.staffName)
            const staffIds = info.entries.map(e => e.staffId)
            const notification = buildMissingClockNotification(staffNames, today)

            if (info.slackChannelId) {
              await sendProjectNotification(notification, info.slackChannelId, {
                projectId: projectId !== '__no_project__' ? projectId : null,
                staffId: staffIds,
              })
            }

            // 個別DM送信
            for (const entry of info.entries) {
              try {
                const slackUserId = await resolveStaffSlackUserId(entry.staffId)
                if (slackUserId) {
                  await sendSlackDM(slackUserId, {
                    text: `【打刻漏れ】${entry.staffName}さん、${today}の出勤打刻がされていません`,
                    blocks: [
                      {
                        type: 'section',
                        text: {
                          type: 'mrkdwn',
                          text: `:bell: *打刻漏れのお知らせ*\n${entry.staffName}さん、本日(${today})の出勤打刻がされていません。\nシフトが登録されていますので、打刻をお願いします。`,
                        },
                      },
                    ],
                  })
                }
              } catch (err) {
                console.error(`[attendance-alerts] DM error for ${entry.staffName}:`, err)
                results.no_attendance.errors++
              }
            }
          } catch (err) {
            console.error(`[attendance-alerts] no_attendance project notification error:`, err)
            results.no_attendance.errors++
          }
        }
      }
    } catch (err) {
      console.error('[attendance-alerts] no_attendance check error:', err)
    }

    // ========================================
    // 3. 残業超過: work_minutes > 600 (10時間)
    // ========================================
    try {
      const { data: overtimeRecords } = await admin
        .from('attendance_records')
        .select('user_id, staff_id, work_minutes, project_id, staff:staff_id(id, last_name, first_name), project:project_id(id, name, slack_channel_id)')
        .eq('date', today)
        .is('deleted_at', null)
        .gt('work_minutes', 600)

      if (overtimeRecords) {
        for (const rec of overtimeRecords) {
          results.overtime.checked++
          const staff = rec.staff as unknown as { id: string; last_name: string; first_name: string } | null
          const project = rec.project as unknown as { id: string; name: string; slack_channel_id: string | null } | null
          const staffName = staff ? `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明' : '不明'
          const hours = Math.round((rec.work_minutes || 0) / 60 * 10) / 10

          try {
            results.overtime.alerted++
            results.overtime.names.push(staffName)

            const notification = buildOvertimeWarningNotification(staffName, hours, today)

            // プロジェクトチャンネルに通知
            if (project?.slack_channel_id) {
              await sendProjectNotification(notification, project.slack_channel_id, {
                projectId: rec.project_id,
                staffId: rec.staff_id,
              })
            }

            // 本人にDM
            if (rec.staff_id) {
              const slackUserId = await resolveStaffSlackUserId(rec.staff_id)
              if (slackUserId) {
                await sendSlackDM(slackUserId, {
                  text: `【残業警告】${staffName}さん、本日の勤務時間が${hours}時間を超えています`,
                  blocks: [
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `:warning: *残業警告*\n${staffName}さん、本日(${today})の勤務時間が *${hours}時間* を超えています。\n体調に無理のないようお気をつけください。`,
                      },
                    },
                  ],
                })
              }
            }
          } catch (err) {
            console.error(`[attendance-alerts] overtime notification error for ${staffName}:`, err)
            results.overtime.errors++
          }
        }
      }
    } catch (err) {
      console.error('[attendance-alerts] overtime check error:', err)
    }

    return NextResponse.json({
      success: true,
      date: today,
      jstTime: `${String(jstHours).padStart(2, '0')}:${String(jstMinutes).padStart(2, '0')}`,
      results,
    })
  } catch (error) {
    console.error('[attendance-alerts] Cron error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
