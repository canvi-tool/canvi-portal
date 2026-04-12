import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendProjectNotification } from '@/lib/integrations/slack'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * 稼働状況アラート Cron Job
 *
 * 毎時実行し、以下の異常を検知:
 *
 * Type A: shift_no_attendance_no_report
 *   - 今日の承認済みシフトあり（開始から30分以上経過）
 *   - 打刻なし（attendance_records に clock_in なし）
 *   - 日報なし（work_reports に draft 以外なし）
 *
 * Type B: report_no_attendance
 *   - 今日の日報あり（submitted / approved）
 *   - 打刻なし
 *
 * vercel.json に追加が必要:
 *   { "path": "/api/cron/work-status-alerts", "schedule": "0 * * * *" }
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

  // 月/日 表示用
  const month = jstNow.getUTCMonth() + 1
  const day = jstNow.getUTCDate()
  const dateLabel = `${month}/${day}`

  const results = {
    date: today,
    jstTime: `${String(jstHours).padStart(2, '0')}:${String(jstMinutes).padStart(2, '0')}`,
    type_a: { detected: 0, names: [] as string[] },
    type_b: { detected: 0, names: [] as string[] },
    alerts_inserted: 0,
    notifications_sent: 0,
    errors: 0,
  }

  try {
    // ========================================
    // 1. 今日の承認済みシフトを取得（WORK タイプのみ）
    // ========================================
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: todayShifts, error: shiftsError } = await (admin as any)
      .from('shifts')
      .select(
        'id, staff_id, project_id, start_time, end_time, shift_type, ' +
        'staff:staff_id(id, last_name, first_name, user_id), ' +
        'project:project_id(id, name, slack_channel_id)'
      )
      .eq('shift_date', today)
      .eq('status', 'APPROVED')
      .eq('shift_type', 'WORK')
      .is('deleted_at', null) as { data: Array<{ id: string; staff_id: string; project_id: string | null; start_time: string; end_time: string | null; shift_type: string; staff: { id: string; last_name: string; first_name: string; user_id: string } | null; project: { id: string; name: string; slack_channel_id: string | null } | null }> | null; error: unknown }

    if (shiftsError) {
      console.error('[work-status-alerts] shifts query error:', shiftsError)
      throw shiftsError
    }

    // ========================================
    // 2. 今日の打刻レコードを取得
    // ========================================
    const { data: todayAttendance, error: attError } = await admin
      .from('attendance_records')
      .select('user_id, staff_id, clock_in')
      .eq('date', today)
      .is('deleted_at', null)
      .not('clock_in', 'is', null)

    if (attError) {
      console.error('[work-status-alerts] attendance query error:', attError)
      throw attError
    }

    // 打刻済み user_id / staff_id のセット
    const clockedUserIds = new Set((todayAttendance || []).map(a => a.user_id).filter(Boolean))
    const clockedStaffIds = new Set((todayAttendance || []).map(a => a.staff_id).filter(Boolean))

    // ========================================
    // 3. 今日の日報を取得（draft 以外）
    // ========================================
    const { data: todayReports, error: reportsError } = await admin
      .from('work_reports')
      .select('staff_id, status')
      .eq('report_date', today)
      .neq('status', 'draft')
      .is('deleted_at', null)

    if (reportsError) {
      console.error('[work-status-alerts] work_reports query error:', reportsError)
      throw reportsError
    }

    // 日報提出済み staff_id のセット
    const reportedStaffIds = new Set((todayReports || []).map(r => r.staff_id).filter(Boolean))

    // ========================================
    // 4. 異常検知
    // ========================================

    // プロジェクト別にアラートをグループ化
    const alertsByProject = new Map<string, {
      projectName: string
      slackChannelId: string | null
      typeA: Array<{ staffName: string; staffId: string; shiftId: string; startTime: string; endTime: string | null }>
      typeB: Array<{ staffName: string; staffId: string }>
    }>()

    function getOrCreateProjectGroup(projectId: string, projectName: string, slackChannelId: string | null) {
      let group = alertsByProject.get(projectId)
      if (!group) {
        group = { projectName, slackChannelId, typeA: [], typeB: [] }
        alertsByProject.set(projectId, group)
      }
      return group
    }

    // --- Type A: シフト予定あり・打刻なし・日報なし ---
    if (todayShifts && todayShifts.length > 0) {
      for (const shift of todayShifts) {
        const staff = shift.staff
        const project = shift.project

        if (!staff || !shift.start_time) continue

        // シフト開始 + 30分 を過ぎているかチェック
        const [h, m] = shift.start_time.split(':').map(Number)
        const shiftStartMinutes = h * 60 + m
        if (nowMinutesSinceMidnight < shiftStartMinutes + 30) continue

        // 打刻済みならスキップ
        if (clockedUserIds.has(staff.user_id) || clockedStaffIds.has(staff.id)) continue

        // 日報提出済みならスキップ（Type A は両方なしの場合のみ）
        if (reportedStaffIds.has(shift.staff_id)) continue

        const staffName = `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明'
        const projectId = project?.id || '__no_project__'
        const group = getOrCreateProjectGroup(
          projectId,
          project?.name || '未割当',
          project?.slack_channel_id || null
        )

        group.typeA.push({
          staffName,
          staffId: shift.staff_id,
          shiftId: shift.id,
          startTime: shift.start_time,
          endTime: shift.end_time || null,
        })

        results.type_a.detected++
        results.type_a.names.push(staffName)
      }
    }

    // --- Type B: 日報提出済み・打刻なし ---
    if (todayReports && todayReports.length > 0) {
      // 日報のある staff_id でシフト情報も必要なので、staff 情報を取得
      const reportStaffIds = [...reportedStaffIds]
      if (reportStaffIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: reportStaffs } = await (admin as any)
          .from('staff')
          .select('id, last_name, first_name, user_id, project_assignments(project_id, project:project_id(id, name, slack_channel_id))')
          .in('id', reportStaffIds) as { data: Array<{ id: string; last_name: string; first_name: string; user_id: string; project_assignments: Array<{ project_id: string; project: { id: string; name: string; slack_channel_id: string | null } | null }> | null }> | null }

        if (reportStaffs) {
          for (const staff of reportStaffs) {
            if (!staff.id) continue

            // 打刻済みならスキップ
            if (clockedUserIds.has(staff.user_id) || clockedStaffIds.has(staff.id)) continue

            const staffName = `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明'

            // プロジェクト割当からプロジェクト情報を取得
            const assignments = staff.project_assignments as unknown as Array<{
              project_id: string
              project: { id: string; name: string; slack_channel_id: string | null } | null
            }> | null

            if (assignments && assignments.length > 0) {
              // 各プロジェクトに対して Type B アラートを追加
              for (const assignment of assignments) {
                const project = assignment.project
                const projectId = project?.id || '__no_project__'
                const group = getOrCreateProjectGroup(
                  projectId,
                  project?.name || '未割当',
                  project?.slack_channel_id || null
                )
                // 重複チェック（同じスタッフが複数回追加されるのを防ぐ）
                if (!group.typeB.some(b => b.staffId === staff.id)) {
                  group.typeB.push({ staffName, staffId: staff.id })
                }
              }
            } else {
              // プロジェクト割当がない場合
              const group = getOrCreateProjectGroup('__no_project__', '未割当', null)
              if (!group.typeB.some(b => b.staffId === staff.id)) {
                group.typeB.push({ staffName, staffId: staff.id })
              }
            }

            results.type_b.detected++
            results.type_b.names.push(staffName)
          }
        }
      }
    }

    // ========================================
    // 5. アラートDB保存 + Slack通知
    // ========================================
    for (const [projectId, group] of alertsByProject) {
      const hasAlerts = group.typeA.length > 0 || group.typeB.length > 0
      if (!hasAlerts) continue

      // --- alerts テーブルに保存（重複防止: recurrence_key で upsert） ---
      const alertRows: Array<{
        title: string
        message: string
        category: string
        severity: string
        status: string
        target_staff_id: string
        resource_type: string
        resource_id: string | null
        due_date: string
        recurrence_key: string
        metadata: Record<string, unknown>
      }> = []

      for (const entry of group.typeA) {
        const recurrenceKey = `work_status_a_${today}_${entry.staffId}_${entry.shiftId}`
        alertRows.push({
          title: 'シフト予定あり・打刻なし・日報なし',
          message: `${entry.staffName} のシフト (${formatTime(entry.startTime)}〜${entry.endTime ? formatTime(entry.endTime) : '?'}) に対して打刻・日報がありません`,
          category: 'attendance_issue',
          severity: 'warning',
          status: 'active',
          target_staff_id: entry.staffId,
          resource_type: 'shift',
          resource_id: entry.shiftId,
          due_date: today,
          recurrence_key: recurrenceKey,
          metadata: {
            alert_subtype: 'shift_no_attendance_no_report',
            shift_id: entry.shiftId,
            date: today,
            project_id: projectId !== '__no_project__' ? projectId : null,
          },
        })
      }

      for (const entry of group.typeB) {
        const recurrenceKey = `work_status_b_${today}_${entry.staffId}`
        alertRows.push({
          title: '日報提出済み・打刻なし',
          message: `${entry.staffName} は日報を提出済みですが、打刻がありません`,
          category: 'attendance_issue',
          severity: 'warning',
          status: 'active',
          target_staff_id: entry.staffId,
          resource_type: 'work_report',
          resource_id: null,
          due_date: today,
          recurrence_key: recurrenceKey,
          metadata: {
            alert_subtype: 'report_no_attendance',
            date: today,
            project_id: projectId !== '__no_project__' ? projectId : null,
          },
        })
      }

      // recurrence_key の重複がある場合はスキップ（ON CONFLICT DO NOTHING 相当）
      for (const row of alertRows) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: existing } = await (admin as any)
            .from('alerts')
            .select('id')
            .eq('recurrence_key', (row as Record<string, unknown>).recurrence_key)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle()

          if (!existing) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: insertError } = await (admin as any)
              .from('alerts')
              .insert(row)

            if (insertError) {
              // 一意制約違反の場合は無視（並行実行対策）
              if (!insertError.message?.includes('duplicate') && !insertError.code?.includes('23505')) {
                console.error('[work-status-alerts] alert insert error:', insertError)
              }
            } else {
              results.alerts_inserted++
            }
          }
        } catch (err) {
          console.error('[work-status-alerts] alert upsert error:', err)
        }
      }

      // --- Slack通知（プロジェクトごとに1通にまとめる） ---
      try {
        const lines: string[] = []
        lines.push(`*:warning: 稼働状況アラート（${dateLabel}）*`)
        lines.push('')

        if (group.typeA.length > 0) {
          lines.push(':clipboard: *シフト予定あり・打刻なし・日報なし:*')
          for (const entry of group.typeA) {
            const timeRange = `${formatTime(entry.startTime)}〜${entry.endTime ? formatTime(entry.endTime) : '?'}`
            lines.push(`  • ${entry.staffName} (${timeRange})`)
          }
          lines.push('')
        }

        if (group.typeB.length > 0) {
          lines.push(':clipboard: *日報提出済み・打刻なし:*')
          for (const entry of group.typeB) {
            lines.push(`  • ${entry.staffName}`)
          }
          lines.push('')
        }

        const notification = {
          text: lines.join('\n'),
        }

        if (group.slackChannelId) {
          const staffIds = [
            ...group.typeA.map(a => a.staffId),
            ...group.typeB.map(b => b.staffId),
          ]
          await sendProjectNotification(notification, group.slackChannelId, {
            projectId: projectId !== '__no_project__' ? projectId : null,
            staffId: staffIds.length > 0 ? staffIds : null,
          })
          results.notifications_sent++
        }
      } catch (err) {
        console.error(`[work-status-alerts] notification error for project ${group.projectName}:`, err)
        results.errors++
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (error) {
    console.error('[work-status-alerts] Cron error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

/** HH:MM:SS -> HH:MM */
function formatTime(time: string): string {
  return time.slice(0, 5)
}
