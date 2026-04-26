import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildShiftUnsubmittedAlertNotification,
  sendSlackDM,
  resolveStaffSlackUserId,
} from '@/lib/integrations/slack'

/**
 * シフト未提出アラート（締切後・繰り返し送信）
 *
 * Vercel Cron: 0 * * * *  （毎時 0 分実行）
 *
 * 各プロジェクトの project_notification_settings を見て、
 *   - shift_unsubmitted_alert = true
 *   - 現在の JST 時刻が shift_unsubmitted_alert_hour と一致
 *   - 締切日 (shift_submission_deadline_day) を過ぎている
 *   - (今日 - 締切日) % shift_unsubmitted_alert_interval_days === 0
 *   - そのスタッフの送信回数 < shift_unsubmitted_alert_max_repeats
 * を満たすものに対してSlack DMを送信する。
 */

interface NotificationSettingsRow {
  project_id: string
  shift_unsubmitted_alert: boolean
  shift_unsubmitted_alert_hour: number
  shift_unsubmitted_alert_interval_days: number
  shift_unsubmitted_alert_max_repeats: number
  shift_submission_deadline_day: number
}

interface AssignmentRow {
  staff_id: string
  staff: { id: string; last_name: string | null; first_name: string | null; status: string | null } | null
}

/** JSTの現在日時を { year, month, day, hour } で取得 */
function nowJst(): { year: number; month: number; day: number; hour: number } {
  const now = new Date()
  // toLocaleString は呼び出すたびにDate生成するためまとめて取得
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(now)
  const obj: Record<string, string> = {}
  for (const p of parts) obj[p.type] = p.value
  return {
    year: parseInt(obj.year, 10),
    month: parseInt(obj.month, 10),
    day: parseInt(obj.day, 10),
    hour: parseInt(obj.hour, 10) % 24,
  }
}

/** 翌月の YYYY-MM を返す（締切後シフトの対象月） */
function nextMonthKey(year: number, month: number): string {
  const m = month === 12 ? 1 : month + 1
  const y = month === 12 ? year + 1 : year
  return `${y}-${String(m).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const jst = nowJst()

    // 全プロジェクト分の通知設定（未提出アラートONのもの）を取得
    const { data: settingsList, error: settingsErr } = await supabase
      .from('project_notification_settings')
      .select(
        'project_id, shift_unsubmitted_alert, shift_unsubmitted_alert_hour, shift_unsubmitted_alert_interval_days, shift_unsubmitted_alert_max_repeats, shift_submission_deadline_day'
      )
      .eq('shift_unsubmitted_alert', true)
      .returns<NotificationSettingsRow[]>()

    if (settingsErr) {
      console.error('settings fetch error:', settingsErr)
      return NextResponse.json({ error: settingsErr.message }, { status: 500 })
    }
    if (!settingsList || settingsList.length === 0) {
      return NextResponse.json({ message: 'No projects with unsubmitted alert enabled', sent: 0 })
    }

    let totalSent = 0
    const skipped: Array<{ projectId: string; reason: string }> = []

    for (const s of settingsList) {
      // 1. 設定時刻チェック
      if (s.shift_unsubmitted_alert_hour !== jst.hour) {
        continue // 時刻不一致 (毎時実行されるが指定時刻のみ送信)
      }

      // 2. 締切日後かどうか + 間隔チェック
      const deadlineDay = s.shift_submission_deadline_day
      const daysSinceDeadline = jst.day - deadlineDay
      if (daysSinceDeadline < 1) {
        skipped.push({ projectId: s.project_id, reason: 'before_or_on_deadline' })
        continue
      }
      if (daysSinceDeadline % Math.max(1, s.shift_unsubmitted_alert_interval_days) !== 0) {
        skipped.push({ projectId: s.project_id, reason: 'not_interval_day' })
        continue
      }

      // 3. プロジェクト & チャンネル取得
      const { data: project } = await supabase
        .from('projects')
        .select('id, name, slack_channel_id, status')
        .eq('id', s.project_id)
        .single()
      if (!project || project.status !== 'active') {
        skipped.push({ projectId: s.project_id, reason: 'project_inactive' })
        continue
      }

      // 4. プロジェクトの稼働中アサインスタッフ
      const { data: assignments } = await supabase
        .from('project_assignments')
        .select('staff_id, staff:staff_id(id, last_name, first_name, status)')
        .eq('project_id', s.project_id)
        .is('unassigned_at', null)
        .returns<AssignmentRow[]>()

      const activeStaff = (assignments || []).filter(
        (a) => a.staff && a.staff.status !== 'retired'
      )
      if (activeStaff.length === 0) continue

      // 5. 対象月 (次月) のシフトを取得 → 提出済みstaff_idセット
      const targetMonth = nextMonthKey(jst.year, jst.month)
      const monthStart = `${targetMonth}-01`
      const lastDay = new Date(
        parseInt(targetMonth.split('-')[0], 10),
        parseInt(targetMonth.split('-')[1], 10),
        0
      ).getDate()
      const monthEnd = `${targetMonth}-${String(lastDay).padStart(2, '0')}`

      const { data: shifts } = await supabase
        .from('shifts')
        .select('staff_id')
        .eq('project_id', s.project_id)
        .gte('shift_date', monthStart)
        .lte('shift_date', monthEnd)
        .is('deleted_at', null)

      const submittedStaffIds = new Set((shifts || []).map((sh) => sh.staff_id))

      // 6. 未提出スタッフ
      const unsubmitted = activeStaff.filter((a) => !submittedStaffIds.has(a.staff_id))
      if (unsubmitted.length === 0) continue

      // 7. period_key (project + target_month で同じ提出期間)
      const periodKey = `${s.project_id}:${targetMonth}`

      // 8. 各未提出スタッフへ送信
      const deadlineDate = `${jst.year}-${String(jst.month).padStart(2, '0')}-${String(deadlineDay).padStart(2, '0')}`

      for (const a of unsubmitted) {
        if (!a.staff) continue

        // 8-1. 送信履歴取得
        const { data: logs } = await supabase
          .from('notification_dispatch_log')
          .select('id, sent_at')
          .eq('project_id', s.project_id)
          .eq('staff_id', a.staff_id)
          .eq('notification_type', 'shift_unsubmitted')
          .eq('period_key', periodKey)
          .order('sent_at', { ascending: false })

        const sentCount = logs?.length || 0

        // 8-2. 最大回数チェック
        if (
          s.shift_unsubmitted_alert_max_repeats > 0 &&
          sentCount >= s.shift_unsubmitted_alert_max_repeats
        ) {
          continue
        }

        // 8-3. 同日重複防止（同じJST日に既に送っていればスキップ）
        if (logs && logs.length > 0) {
          const last = new Date(logs[0].sent_at)
          const lastJstDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(last)
          const todayJstDate = `${jst.year}-${String(jst.month).padStart(2, '0')}-${String(jst.day).padStart(2, '0')}`
          if (lastJstDate === todayJstDate) {
            continue
          }
        }

        // 8-4. Slack DM 送信
        const slackUserId = await resolveStaffSlackUserId(a.staff_id)
        if (!slackUserId) {
          // Slack未連携: 履歴は残さず次回再試行
          console.warn(
            `[shift-unsubmitted-alerts] no slack_user_id for staff=${a.staff_id} project=${s.project_id}`
          )
          continue
        }

        const staffName = `${a.staff.last_name || ''} ${a.staff.first_name || ''}`.trim() || 'メンバー'
        const repeatNumber = sentCount + 1
        const msg = buildShiftUnsubmittedAlertNotification(
          staffName,
          deadlineDate,
          targetMonth,
          project.name,
          repeatNumber,
          s.shift_unsubmitted_alert_max_repeats,
        )

        const result = await sendSlackDM(slackUserId, msg)
        if (!result.success) {
          console.error(
            `[shift-unsubmitted-alerts] DM failed staff=${a.staff_id}: ${result.error}`
          )
          continue
        }

        // 8-5. 履歴を記録
        await supabase.from('notification_dispatch_log').insert({
          project_id: s.project_id,
          staff_id: a.staff_id,
          notification_type: 'shift_unsubmitted',
          period_key: periodKey,
          metadata: { repeat_number: repeatNumber, deadline: deadlineDate, target_month: targetMonth },
        })

        totalSent++
      }
    }

    return NextResponse.json({
      message: 'Shift unsubmitted alerts cron completed',
      sent: totalSent,
      checkedProjects: settingsList.length,
      skipped,
      jst,
    })
  } catch (error) {
    console.error('[shift-unsubmitted-alerts] error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
