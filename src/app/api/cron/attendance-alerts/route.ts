import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendProjectNotification,
  sendSlackDM,
  resolveStaffSlackUserId,
  buildClockOutMissingDMNotification,
} from '@/lib/integrations/slack'

/**
 * 勤怠アラート Cron Job (毎時実行)
 *
 * チェック項目:
 * 1. 退勤漏れ — clocked_in のまま shift.end_time + 30分 超過
 * 2. 残業超過 — work_minutes > 600 (10時間)
 *
 * ※ 打刻漏れは /api/cron/attendance-check で処理（project_notification_settings の
 *   interval/max_repeats 設定を参照 + attendance_alert_log で重複防止）
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
                        text: `:warning: 退勤未打刻 — ${staffName} さんが出勤中のまま退勤打刻がされていません (${today} / ${project.name})`,
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
    // 2. 残業超過: Slack通知は無効化（ユーザー要望により停止）
    // ========================================
    // 過去に通知が大量送出されたため、残業警告のSlack通知は完全停止。

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
