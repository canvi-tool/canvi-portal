import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildShiftVarianceAlertNotification,
  sendProjectNotification,
} from '@/lib/integrations/slack'

/**
 * シフト変動アラート（前月比）
 *
 * Vercel Cron: 0 0 * * *  (UTC 00:00 = JST 09:00 / 毎日)
 *
 * 各プロジェクトの project_notification_settings を見て:
 *   - shift_variance_alert = true
 *   - 今日が締切日+1 (= 提出締切翌日。提出が出揃ったタイミングで1回チェック)
 * を満たす場合に、対象月の提出済みシフト時間と前月実績を比較し、
 * 増減率が shift_variance_alert_threshold_pct を超えたスタッフごとに
 * プロジェクトSlackチャンネルへアラートを送る。
 *
 * 同一 (project, target_month, staff) には1回しか送らない。
 */

interface SettingsRow {
  project_id: string
  shift_variance_alert: boolean
  shift_variance_alert_threshold_pct: number
  shift_variance_alert_min_baseline_hours: number
  shift_submission_deadline_day: number
}

interface ShiftRow {
  staff_id: string
  start_time: string | null
  end_time: string | null
  shift_date: string
  status: string | null
}

interface AssignmentRow {
  staff_id: string
  staff: { id: string; last_name: string | null; first_name: string | null; status: string | null } | null
}

function nowJstDayMonthYear(): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(new Date())
  const o: Record<string, string> = {}
  for (const p of parts) o[p.type] = p.value
  return {
    year: parseInt(o.year, 10),
    month: parseInt(o.month, 10),
    day: parseInt(o.day, 10),
  }
}

/** YYYY-MM 形式で 月加算/減算 */
function shiftMonthKey(year: number, month: number, delta: number): string {
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthRange(monthKey: string): { start: string; end: string } {
  const [yStr, mStr] = monthKey.split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  const last = new Date(y, m, 0).getDate()
  return {
    start: `${monthKey}-01`,
    end: `${monthKey}-${String(last).padStart(2, '0')}`,
  }
}

/** time(HH:MM:SS) 同士の差分を分で返す */
function diffMinutes(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  return mins
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const jst = nowJstDayMonthYear()

    // 全プロジェクト分の設定（変動アラートONのもの）
    const { data: settingsList, error: settingsErr } = await supabase
      .from('project_notification_settings')
      .select(
        'project_id, shift_variance_alert, shift_variance_alert_threshold_pct, shift_variance_alert_min_baseline_hours, shift_submission_deadline_day'
      )
      .eq('shift_variance_alert', true)
      .returns<SettingsRow[]>()

    if (settingsErr) {
      return NextResponse.json({ error: settingsErr.message }, { status: 500 })
    }
    if (!settingsList || settingsList.length === 0) {
      return NextResponse.json({ message: 'No projects with variance alert enabled', sent: 0 })
    }

    let totalSent = 0
    const results: Array<{ projectId: string; staffId: string; diffPct: number }> = []

    for (const s of settingsList) {
      // 締切翌日のみ実行 (提出が出揃った時点で1回チェック)
      if (jst.day !== s.shift_submission_deadline_day + 1) {
        continue
      }

      // 対象月 (これから到来する次月)
      const targetMonth = shiftMonthKey(jst.year, jst.month, 1)
      const baselineMonth = shiftMonthKey(jst.year, jst.month, 0) // 今月実績 = 前月相当
      const targetRange = monthRange(targetMonth)
      const baselineRange = monthRange(baselineMonth)

      const { data: project } = await supabase
        .from('projects')
        .select('id, name, slack_channel_id, status')
        .eq('id', s.project_id)
        .single()
      if (!project || project.status !== 'active' || !project.slack_channel_id) {
        continue
      }

      // アサイン中のスタッフ
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

      // target / baseline のシフトをまとめて取得 (status関係なくsubmission済みも含む)
      const allowedStatus = ['SUBMITTED', 'APPROVED'] as const

      const { data: targetShifts } = await supabase
        .from('shifts')
        .select('staff_id, start_time, end_time, shift_date, status')
        .eq('project_id', s.project_id)
        .gte('shift_date', targetRange.start)
        .lte('shift_date', targetRange.end)
        .in('status', allowedStatus)
        .is('deleted_at', null)
        .returns<ShiftRow[]>()

      const { data: baselineShifts } = await supabase
        .from('shifts')
        .select('staff_id, start_time, end_time, shift_date, status')
        .eq('project_id', s.project_id)
        .gte('shift_date', baselineRange.start)
        .lte('shift_date', baselineRange.end)
        .in('status', allowedStatus)
        .is('deleted_at', null)
        .returns<ShiftRow[]>()

      const sumByStaff = (rows: ShiftRow[] | null): Map<string, number> => {
        const m = new Map<string, number>()
        for (const r of rows || []) {
          const mins = diffMinutes(r.start_time, r.end_time)
          m.set(r.staff_id, (m.get(r.staff_id) || 0) + mins)
        }
        return m
      }

      const targetMinutes = sumByStaff(targetShifts || null)
      const baselineMinutes = sumByStaff(baselineShifts || null)

      for (const a of activeStaff) {
        if (!a.staff) continue
        const tgtMin = targetMinutes.get(a.staff_id) || 0
        const baseMin = baselineMinutes.get(a.staff_id) || 0
        const tgtH = tgtMin / 60
        const baseH = baseMin / 60

        // ノイズ防止: 前月実績がしきい時間未満ならスキップ
        if (baseH < s.shift_variance_alert_min_baseline_hours) continue

        const diffPct = ((tgtH - baseH) / baseH) * 100
        if (Math.abs(diffPct) < s.shift_variance_alert_threshold_pct) continue

        // 冪等チェック (同一 project + target_month + staff で1回のみ)
        const periodKey = `${s.project_id}:${targetMonth}:${a.staff_id}`
        const { data: existing } = await supabase
          .from('notification_dispatch_log')
          .select('id')
          .eq('project_id', s.project_id)
          .eq('staff_id', a.staff_id)
          .eq('notification_type', 'shift_variance')
          .eq('period_key', periodKey)
          .limit(1)
        if (existing && existing.length > 0) continue

        const staffName =
          `${a.staff.last_name || ''} ${a.staff.first_name || ''}`.trim() || 'メンバー'

        const msg = buildShiftVarianceAlertNotification(
          staffName,
          project.name,
          baseH,
          tgtH,
          diffPct,
          targetMonth,
        )

        const result = await sendProjectNotification(msg, project.slack_channel_id, {
          projectId: s.project_id,
          staffId: a.staff_id,
          noMention: true,
        })
        if (!result.success) {
          console.error(
            `[shift-variance-alerts] notify failed project=${s.project_id} staff=${a.staff_id}:`,
            result.error,
          )
          continue
        }

        await supabase.from('notification_dispatch_log').insert({
          project_id: s.project_id,
          staff_id: a.staff_id,
          notification_type: 'shift_variance',
          period_key: periodKey,
          metadata: {
            target_month: targetMonth,
            baseline_month: baselineMonth,
            target_hours: tgtH,
            baseline_hours: baseH,
            diff_pct: Math.round(diffPct),
          },
        })

        totalSent++
        results.push({ projectId: s.project_id, staffId: a.staff_id, diffPct })
      }
    }

    return NextResponse.json({
      message: 'Shift variance alerts cron completed',
      sent: totalSent,
      checkedProjects: settingsList.length,
      results,
      jst,
    })
  } catch (error) {
    console.error('[shift-variance-alerts] error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
