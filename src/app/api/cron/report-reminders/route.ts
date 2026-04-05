import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendSlackDM,
  sendProjectNotification,
  resolveStaffSlackUserId,
  buildReportReminderDMNotification,
  buildReportOverdueNotification,
} from '@/lib/integrations/slack'

/**
 * 日報未提出リマインダー Cron Job
 *
 * 平日 21:00 JST に実行
 * 今日出勤した（attendance_recordsあり）が日報未提出のスタッフにリマインド
 * - 本人にSlack DM
 * - プロジェクトチャンネルにまとめ通知
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

  const results = {
    checked: 0,
    reminded: 0,
    errors: 0,
    names: [] as string[],
  }

  try {
    // 今日出勤した（clock_inあり）スタッフを取得
    const { data: todayAttendance } = await admin
      .from('attendance_records')
      .select('user_id, staff_id, project_id, staff:staff_id(id, last_name, first_name), project:project_id(id, name, slack_channel_id)')
      .eq('date', today)
      .is('deleted_at', null)
      .not('clock_in', 'is', null)

    if (!todayAttendance || todayAttendance.length === 0) {
      return NextResponse.json({
        success: true,
        date: today,
        message: '今日の出勤記録がありません',
        results,
      })
    }

    // 今日の日報を提出済みのstaff_idを取得
    const { data: todayReports } = await admin
      .from('work_reports')
      .select('staff_id')
      .eq('report_date', today)
      .not('report_type', 'is', null)

    const reportedStaffIds = new Set(
      (todayReports || []).map(r => r.staff_id).filter(Boolean)
    )

    // プロジェクト別に未提出者をグループ化
    const unreportedByProject = new Map<string, {
      projectName: string
      slackChannelId: string | null
      entries: { staffId: string; staffName: string }[]
    }>()

    for (const attendance of todayAttendance) {
      results.checked++
      const staff = attendance.staff as unknown as { id: string; last_name: string; first_name: string } | null
      const project = attendance.project as unknown as { id: string; name: string; slack_channel_id: string | null } | null

      if (!attendance.staff_id || !staff) continue

      // 日報提出済みならスキップ
      if (reportedStaffIds.has(attendance.staff_id)) continue

      const staffName = `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明'
      results.reminded++
      results.names.push(staffName)

      // 本人にDM送信
      try {
        const slackUserId = await resolveStaffSlackUserId(attendance.staff_id)
        if (slackUserId) {
          await sendSlackDM(
            slackUserId,
            buildReportReminderDMNotification(staffName, today)
          )
        }
      } catch (err) {
        console.error(`[report-reminders] DM error for ${staffName}:`, err)
        results.errors++
      }

      // プロジェクト別にグループ化
      const projectId = project?.id || '__no_project__'
      const existing = unreportedByProject.get(projectId) || {
        projectName: project?.name || '未割当',
        slackChannelId: project?.slack_channel_id || null,
        entries: [],
      }
      existing.entries.push({ staffId: attendance.staff_id, staffName })
      unreportedByProject.set(projectId, existing)
    }

    // プロジェクト別にチャンネル通知
    for (const [projectId, info] of unreportedByProject) {
      if (info.entries.length === 0) continue

      try {
        const staffNames = info.entries.map(e => e.staffName)
        const staffIds = info.entries.map(e => e.staffId)
        const notification = buildReportOverdueNotification(staffNames, today)

        if (info.slackChannelId) {
          await sendProjectNotification(notification, info.slackChannelId, {
            projectId: projectId !== '__no_project__' ? projectId : null,
            staffId: staffIds,
          })
        }
      } catch (err) {
        console.error(`[report-reminders] project notification error:`, err)
        results.errors++
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      results,
    })
  } catch (error) {
    console.error('[report-reminders] Cron error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
