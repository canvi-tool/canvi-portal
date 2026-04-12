import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendProjectNotification } from '@/lib/integrations/slack'
import type { DerivedAlert, DerivedAlertType } from '@/lib/alerts/recent-alerts'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * AIアラート Slack定時通知
 *
 * 毎日 9:00 / 15:00 / 21:00 JST に実行
 * 直近14日間の未解決アラートをプロジェクト別にSlack通知
 * 1通知で全スタッフ分をまとめて記載
 *
 * vercel.json: { "path": "/api/cron/alert-slack-summary", "schedule": "0 0,6,12 * * *" }
 * (UTC 0:00=JST 9:00, UTC 6:00=JST 15:00, UTC 12:00=JST 21:00)
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
  const jstHours = jstNow.getUTCHours()
  const timeLabel = `${String(jstHours).padStart(2, '0')}:00`

  const today = jstNow.toISOString().split('T')[0]

  // Calculate lookback date (14 days)
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - 14)
  const lookbackStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(lookbackDate)

  // Floor to 1st of current month (JST) - don't look back into previous months
  const currentMonthFirst = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, '0')}-01`

  // Use the later of the two dates
  const fromStr = lookbackStr > currentMonthFirst ? lookbackStr : currentMonthFirst

  const results = {
    time: timeLabel,
    alertCount: 0,
    projectsNotified: 0,
    errors: [] as string[],
  }

  try {
    // ========================================
    // 1. 直近14日間のシフトを取得（勤怠エラー・日報漏れの検出用）
    // ========================================
    // NOTE: getRecentDerivedAlerts は createServerSupabaseClient (cookie依存) を使うため
    //       cronジョブではcookieが存在しない。adminClientで直接クエリする。

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shifts, error: shiftsError } = await (admin as any)
      .from('shifts')
      .select(
        'id, staff_id, project_id, shift_date, start_time, end_time, ' +
        'staff:staff_id(id, last_name, first_name), ' +
        'project:project_id(id, name, slack_channel_id, project_type)'
      )
      .gte('shift_date', fromStr)
      .lte('shift_date', today)
      .is('deleted_at', null)
      .neq('status', 'REJECTED')
      .limit(500) as { data: Array<{
        id: string; staff_id: string | null; project_id: string | null;
        shift_date: string; start_time: string | null; end_time: string | null;
        staff: { id: string; last_name: string; first_name: string } | null;
        project: { id: string; name: string; slack_channel_id: string | null; project_type: string | null } | null;
      }> | null; error: unknown }

    if (shiftsError) {
      console.error('[alert-slack-summary] shifts query error:', shiftsError)
      throw shiftsError
    }

    if (!shifts || shifts.length === 0) {
      return NextResponse.json({ success: true, message: 'No shifts found', ...results })
    }

    // Internal project types (skip alerts)
    const internalProjectTypes = new Set(['CAN', 'ETC'])

    // 対象シフトをフィルタ
    const targetShifts = shifts.filter(s =>
      s.staff && s.project &&
      !(s.project.project_type && internalProjectTypes.has(s.project.project_type))
    )

    // ========================================
    // 2. 打刻レコードをまとめて取得
    // ========================================
    const staffIdsInShifts = Array.from(new Set(targetShifts.map(s => s.staff_id).filter((x): x is string => !!x)))
    const dateSet = Array.from(new Set(targetShifts.map(s => s.shift_date)))

    const attendanceMap = new Map<string, { clock_in: string | null; clock_out: string | null }>()
    if (staffIdsInShifts.length > 0 && dateSet.length > 0) {
      const { data: arData, error: arError } = await admin
        .from('attendance_records')
        .select('staff_id, date, clock_in, clock_out')
        .in('staff_id', staffIdsInShifts)
        .in('date', dateSet)
        .is('deleted_at', null)
      if (arError) {
        console.error('[alert-slack-summary] attendance_records query error:', arError)
      }
      for (const a of (arData || []) as Array<{ staff_id: string; date: string; clock_in: string | null; clock_out: string | null }>) {
        const key = `${a.staff_id}:${a.date}`
        const existing = attendanceMap.get(key)
        if (existing) {
          attendanceMap.set(key, {
            clock_in: existing.clock_in || a.clock_in,
            clock_out: existing.clock_out || a.clock_out,
          })
        } else {
          attendanceMap.set(key, { clock_in: a.clock_in, clock_out: a.clock_out })
        }
      }
    }

    // ========================================
    // 3. 日報の存在をまとめて取得
    // ========================================
    const workReportStaffDates = new Set<string>()
    if (staffIdsInShifts.length > 0 && dateSet.length > 0) {
      const { data: wrData, error: wrError } = await admin
        .from('work_reports')
        .select('staff_id, report_date')
        .in('staff_id', staffIdsInShifts)
        .in('report_date', dateSet)
        .is('deleted_at', null)
      if (wrError) {
        console.error('[alert-slack-summary] work_reports query error:', wrError)
      }
      for (const w of (wrData || []) as Array<{ staff_id: string | null; report_date: string | null }>) {
        if (w.staff_id && w.report_date) workReportStaffDates.add(`${w.staff_id}:${w.report_date}`)
      }
    }

    // ========================================
    // 4. 日報差戻しを取得
    // ========================================
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rejectedReports, error: rejectedError } = await (admin as any)
      .from('work_reports')
      .select('id, staff_id, project_id, report_date, review_comment, updated_at, staff:staff_id(last_name, first_name), project:project_id(id, name, slack_channel_id)')
      .eq('status', 'rejected')
      .gte('report_date', fromStr)
      .is('deleted_at', null)
      .limit(100) as { data: Array<{
        id: string; staff_id: string | null; project_id: string | null;
        report_date: string; review_comment: string | null; updated_at: string;
        staff: { last_name: string; first_name: string } | null;
        project: { id: string; name: string; slack_channel_id: string | null } | null;
      }> | null; error: unknown }
    if (rejectedError) {
      console.error('[alert-slack-summary] rejected work_reports query error:', rejectedError)
    }

    // ========================================
    // 5. アラートを集計（DerivedAlert形式）
    // ========================================
    const alerts: DerivedAlert[] = []
    const reportMissingEmitted = new Set<string>()

    const nowHHmm = `${String(jstHours).padStart(2, '0')}:${String(jstNow.getUTCMinutes()).padStart(2, '0')}`

    for (const s of targetShifts) {
      const staffName = s.staff ? `${s.staff.last_name} ${s.staff.first_name}` : '不明'
      const projectName = s.project?.name || '不明'
      const key = `${s.staff_id}:${s.shift_date}`
      const ar = attendanceMap.get(key)

      const isPastDate = s.shift_date < today
      const isToday = s.shift_date === today
      const endTime = (s.end_time || '').slice(0, 5)
      const startTime = (s.start_time || '').slice(0, 5)

      const endPassed = isPastDate || (isToday && endTime && endTime <= nowHHmm)
      const startPassed = isPastDate || (isToday && startTime && startTime <= nowHHmm)

      const missingClockIn = startPassed && (!ar || !ar.clock_in)
      const missingClockOut = endPassed && (!ar || !ar.clock_out)

      // 勤怠エラー
      if (missingClockIn || missingClockOut) {
        const parts: string[] = []
        if (missingClockIn) parts.push('出勤打刻なし')
        if (missingClockOut) parts.push('退勤打刻なし')
        const description = `${staffName} / ${projectName} (${s.shift_date}) - ${parts.join('・')}`
        alerts.push({
          id: `attn-err:${s.id}`,
          type: 'ATTENDANCE_ERROR',
          severity: 'WARNING',
          title: '勤怠エラー',
          message: description,
          description,
          relatedStaffId: s.staff_id,
          relatedStaffName: staffName,
          relatedProjectId: s.project_id,
          relatedProjectName: projectName,
          createdAt: `${s.shift_date}T${endTime || '23:59'}:00+09:00`,
        })
      }

      // 日報送付漏れ
      const reportKey = `${s.staff_id}:${s.shift_date}`
      if (endPassed && !workReportStaffDates.has(reportKey) && !reportMissingEmitted.has(reportKey)) {
        reportMissingEmitted.add(reportKey)
        const description = `${staffName} / ${projectName} (${s.shift_date}) の日報未提出`
        alerts.push({
          id: `report-missing:${s.staff_id}:${s.shift_date}`,
          type: 'REPORT_MISSING',
          severity: 'WARNING',
          title: '日報送付漏れ',
          message: description,
          description,
          relatedStaffId: s.staff_id,
          relatedStaffName: staffName,
          relatedProjectId: s.project_id,
          relatedProjectName: projectName,
          createdAt: `${s.shift_date}T${endTime || '23:59'}:00+09:00`,
        })
      }
    }

    // 日報差戻し
    for (const r of (rejectedReports || [])) {
      const staffName = r.staff ? `${r.staff.last_name} ${r.staff.first_name}` : '不明'
      const projectName = r.project?.name || '不明'
      const description = `${staffName} / ${projectName} (${r.report_date}) ${r.review_comment ? '- ' + r.review_comment : 'の日報が差戻されました'}`
      alerts.push({
        id: `report-rej:${r.id}`,
        type: 'REPORT_REJECTED',
        severity: 'CRITICAL',
        title: '日報差戻し',
        message: description,
        description,
        relatedStaffId: r.staff_id,
        relatedStaffName: staffName,
        relatedProjectId: r.project_id,
        relatedProjectName: projectName,
        createdAt: r.updated_at,
      })
    }

    results.alertCount = alerts.length

    if (alerts.length === 0) {
      return NextResponse.json({ success: true, message: 'No alerts to notify', ...results })
    }

    // ========================================
    // 6. プロジェクト別にグループ化してSlack通知
    // ========================================

    // Slack channel情報をプロジェクトから収集
    const slackChannelMap = new Map<string, { channelId: string; projectName: string }>()
    for (const s of targetShifts) {
      if (s.project?.id && s.project.slack_channel_id && !slackChannelMap.has(s.project.id)) {
        slackChannelMap.set(s.project.id, {
          channelId: s.project.slack_channel_id,
          projectName: s.project.name,
        })
      }
    }
    // 差戻し日報のプロジェクトも追加
    for (const r of (rejectedReports || [])) {
      if (r.project?.id && r.project.slack_channel_id && !slackChannelMap.has(r.project.id)) {
        slackChannelMap.set(r.project.id, {
          channelId: r.project.slack_channel_id,
          projectName: r.project.name,
        })
      }
    }

    // プロジェクト別にアラートをグループ化
    const alertsByProject = new Map<string, DerivedAlert[]>()
    for (const alert of alerts) {
      const pid = alert.relatedProjectId || '__no_project__'
      if (!alertsByProject.has(pid)) alertsByProject.set(pid, [])
      alertsByProject.get(pid)!.push(alert)
    }

    // 各プロジェクトにSlack通知を送信
    for (const [projectId, projectAlerts] of alertsByProject) {
      const channelInfo = slackChannelMap.get(projectId)
      if (!channelInfo) {
        const skippedName = alertsByProject.get(projectId)?.[0]?.relatedProjectName || projectId
        console.warn(`[alert-slack-summary] Skipping project ${skippedName}: no Slack channel configured (${projectAlerts.length} alerts)`)
        continue
      }

      try {
        const lines: string[] = []
        lines.push(`*:bell: AIアラート通知（${timeLabel}）*`)
        lines.push(`直近14日間の未解決アラート: ${projectAlerts.length}件`)
        lines.push('')

        // タイプ別にグループ化
        const byType = new Map<DerivedAlertType, DerivedAlert[]>()
        for (const a of projectAlerts) {
          if (!byType.has(a.type)) byType.set(a.type, [])
          byType.get(a.type)!.push(a)
        }

        // 重要度別の絵文字
        const sevEmoji = (s: string) =>
          s === 'CRITICAL' ? ':red_circle:' : s === 'WARNING' ? ':warning:' : ':information_source:'

        for (const [, typeAlerts] of byType) {
          const title = typeAlerts[0].title
          lines.push(`*${title}* (${typeAlerts.length}件)`)
          for (const a of typeAlerts) {
            lines.push(`  ${sevEmoji(a.severity)} ${a.description}`)
          }
          lines.push('')
        }

        const staffIds = projectAlerts
          .map(a => a.relatedStaffId)
          .filter((x): x is string => !!x)

        await sendProjectNotification(
          { text: lines.join('\n') },
          channelInfo.channelId,
          {
            projectId: projectId !== '__no_project__' ? projectId : null,
            staffId: staffIds.length > 0 ? staffIds : null,
          }
        )
        results.projectsNotified++
      } catch (err) {
        const errMsg = `Failed to notify ${channelInfo.projectName}: ${err}`
        console.error(`[alert-slack-summary] ${errMsg}`)
        results.errors.push(errMsg)
      }
    }

    return NextResponse.json({ success: true, ...results })
  } catch (error) {
    console.error('[alert-slack-summary] Error:', error)
    return NextResponse.json({ error: 'Server error', ...results }, { status: 500 })
  }
}
