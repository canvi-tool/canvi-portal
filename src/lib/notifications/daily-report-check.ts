import { createAdminClient } from '@/lib/supabase/admin'
import { sendSlackDM, resolveStaffSlackUserId } from '@/lib/integrations/slack'

/**
 * 退勤打刻トリガーで、当日の日報が未提出ならスタッフ本人にSlack DMで警告する。
 *
 * - fire-and-forget を想定。例外は呼び出し元に伝播させず log のみ。
 * - Slack 未設定・staff の Slack ID 未登録でもエラーにしない。
 * - broadcast しない（本人のみ）。
 * - プロジェクトに report_type が設定されていない場合は日報義務なしとしてスキップ。
 *
 * @param staffId    staff.id (work_reports.staff_id と対応)
 * @param dateJst    YYYY-MM-DD 形式の JST 日付 (work_reports.report_date)
 * @param projectId  project.id（report_type チェック用、省略時はシフトから推定）
 */
export async function notifyIfDailyReportMissing(
  staffId: string | null | undefined,
  dateJst: string,
  projectId?: string | null
): Promise<void> {
  try {
    if (!staffId) return
    if (!dateJst) return

    const admin = createAdminClient()

    // プロジェクトの report_type を確認 — 未設定なら日報義務なしとしてスキップ
    if (projectId) {
      const { data: proj } = await admin
        .from('projects')
        .select('report_type')
        .eq('id', projectId)
        .single()
      if (!proj?.report_type) {
        console.log(`[daily-report-check] project ${projectId} has no report_type, skip`)
        return
      }
    } else {
      // projectId 未指定の場合、当日のシフトからプロジェクトを取得して判定
      const { data: todayShift } = await admin
        .from('shifts')
        .select('project_id, project:project_id(report_type)')
        .eq('staff_id', staffId)
        .eq('shift_date', dateJst)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shiftProject = todayShift?.project as any
      if (todayShift && !shiftProject?.report_type) {
        console.log(`[daily-report-check] shift project has no report_type, skip`)
        return
      }
    }

    // 当日分の日報有無を確認
    const { data: existing, error: selectError } = await admin
      .from('work_reports')
      .select('id')
      .eq('staff_id', staffId)
      .eq('report_date', dateJst)
      .limit(1)
      .maybeSingle()

    if (selectError) {
      console.error('[daily-report-check] work_reports select error:', selectError)
      return
    }

    // 既に提出済みならサイレント
    if (existing) return

    // Slack ID 解決 (未登録でもエラーにしない)
    let slackUserId: string | null = null
    try {
      slackUserId = await resolveStaffSlackUserId(staffId)
    } catch (err) {
      console.error('[daily-report-check] resolveStaffSlackUserId error:', err)
      return
    }

    if (!slackUserId) {
      console.log(`[daily-report-check] no slack user id for staff ${staffId}, skip`)
      return
    }

    const text =
      `<@${slackUserId}> 本日(${dateJst})の日報がまだ提出されていません。\n` +
      `退勤前または直後に提出をお願いします。`

    try {
      const result = await sendSlackDM(slackUserId, { text })
      if (!result.success) {
        console.error('[daily-report-check] sendSlackDM failed:', result.error)
      }
    } catch (err) {
      console.error('[daily-report-check] sendSlackDM threw:', err)
    }
  } catch (err) {
    // すべての例外をここで握りつぶす (退勤打刻 API を失敗させない)
    console.error('[daily-report-check] unexpected error:', err)
  }
}
