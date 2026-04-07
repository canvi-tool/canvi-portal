import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildShiftOverdueNotification, sendProjectNotificationIfEnabled } from '@/lib/integrations/slack'

/**
 * シフト未提出リマインダー
 * 毎月20日〜25日に実行: 翌月シフトが未登録のスタッフを検出 → アラート作成
 * Vercel Cron: 0 0 20-25 * * (UTC 00:00 = JST 09:00, 毎月20-25日)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()
    const currentDay = now.getDate()

    // 20日より前は実行しない
    if (currentDay < 20) {
      return NextResponse.json({ message: 'Not in reminder period', alerted: 0 })
    }

    // 翌月の範囲を算出
    const nextMonth = now.getMonth() + 2 // 0-indexed + 1
    const nextYear = nextMonth > 12 ? now.getFullYear() + 1 : now.getFullYear()
    const nextMonthNorm = nextMonth > 12 ? 1 : nextMonth
    const nextMonthStart = `${nextYear}-${String(nextMonthNorm).padStart(2, '0')}-01`
    const nextMonthEnd = `${nextYear}-${String(nextMonthNorm).padStart(2, '0')}-${new Date(nextYear, nextMonthNorm, 0).getDate()}`

    // 稼働中スタッフ一覧
    const { data: activeStaff } = await supabase
      .from('staff')
      .select('id, user_id, last_name, first_name')
      .eq('status', 'active')

    if (!activeStaff || activeStaff.length === 0) {
      return NextResponse.json({ message: 'No active staff', alerted: 0 })
    }

    // 翌月にシフトが登録されているスタッフを検索
    const { data: shiftsNextMonth } = await supabase
      .from('shifts')
      .select('staff_id')
      .gte('shift_date', nextMonthStart)
      .lte('shift_date', nextMonthEnd)
      .is('deleted_at', null)

    const staffWithShifts = new Set(
      (shiftsNextMonth || []).map(s => s.staff_id)
    )

    // シフト未提出のスタッフ
    const unreported = activeStaff.filter(s => !staffWithShifts.has(s.id))

    if (unreported.length === 0) {
      return NextResponse.json({ message: 'All staff have submitted shifts', alerted: 0 })
    }

    // Phase 2: 購読フィルタ - shift_unsubmitted が全ロールでOFFならスキップ
    let dashboardEnabled = true
    let slackEnabled = true
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subsRes = await (supabase as any)
        .from('alert_subscriptions')
        .select('role, enabled, channel_dashboard, channel_slack')
        .eq('alert_id', 'shift_unsubmitted')
      const subs = (subsRes?.data || []) as Array<{
        role: string
        enabled: boolean
        channel_dashboard: boolean
        channel_slack: boolean
      }>
      if (subs.length > 0) {
        dashboardEnabled = subs.some((s) => s.enabled && s.channel_dashboard)
        slackEnabled = subs.some((s) => s.enabled && s.channel_slack)
      }
    } catch (e) {
      console.error('[shift-reminder] subscription lookup failed:', e)
      // 失敗時は既存挙動維持 (両方ON)
    }

    // アラート作成（重複防止: 同月・同タイプのアラートが既にあればスキップ）
    const alertMonth = `${nextYear}-${String(nextMonthNorm).padStart(2, '0')}`
    let alertedCount = 0

    for (const staff of unreported) {
      const staffName = `${staff.last_name || ''} ${staff.first_name || ''}`.trim()

      // 既存アラートチェック
      const { data: existing } = await supabase
        .from('alerts')
        .select('id')
        .eq('type', 'unreported_work')
        .eq('related_staff_id', staff.id)
        .like('description', `%${alertMonth}%`)
        .limit(1)

      if (existing && existing.length > 0) continue

      // Phase 2: ダッシュボード購読OFFなら in-app insert スキップ
      if (!dashboardEnabled) {
        continue
      }

      // アラート作成
      await supabase.from('alerts').insert({
        type: 'unreported_work',
        severity: currentDay >= 25 ? 'critical' : 'warning',
        title: `${staffName}: ${alertMonth}月のシフト未提出`,
        description: `${staffName}の${alertMonth}月シフトが未登録です。提出期限: ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-25`,
        related_staff_id: staff.id,
        is_resolved: false,
      })

      alertedCount++
    }

    // Slack通知: 未提出スタッフを所属PJごとにまとめて通知
    // gatedキー: report_overdue（期限超過系トグル）を流用
    // Phase 2: shift_unsubmitted の Slack 購読がOFFならスキップ
    const deadline = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-25`
    let slackSent = 0
    try {
      const unreportedIds = unreported.map(s => s.id)
      if (slackEnabled && unreportedIds.length > 0) {
        const { data: assignments } = await supabase
          .from('project_assignments')
          .select('staff_id, project:project_id(id, name, slack_channel_id)')
          .in('staff_id', unreportedIds)
          .is('unassigned_at', null)

        // project_id -> { name, channel, staffNames[] }
        const byProject = new Map<string, { name: string; channel: string | null; names: string[] }>()
        const staffNameMap = new Map(unreported.map(s => [s.id, `${s.last_name || ''} ${s.first_name || ''}`.trim()]))

        for (const a of (assignments || []) as Array<{ staff_id: string; project: { id: string; name: string; slack_channel_id: string | null } | null }>) {
          const p = a.project
          if (!p) continue
          const entry = byProject.get(p.id) || { name: p.name, channel: p.slack_channel_id, names: [] }
          const nm = staffNameMap.get(a.staff_id)
          if (nm && !entry.names.includes(nm)) entry.names.push(nm)
          byProject.set(p.id, entry)
        }

        for (const [projectId, info] of byProject.entries()) {
          if (!info.channel || info.names.length === 0) continue
          const msg = buildShiftOverdueNotification(info.names, deadline, info.name)
          const res = await sendProjectNotificationIfEnabled(msg, projectId, info.channel, 'report_overdue', { noMention: true })
          if (res.success && !res.skipped) slackSent++
        }
      }
    } catch (slackErr) {
      console.error('Shift reminder Slack error:', slackErr)
    }

    return NextResponse.json({
      message: `Shift reminder completed`,
      alerted: alertedCount,
      slackSent,
      totalUnreported: unreported.length,
      period: alertMonth,
    })
  } catch (error) {
    console.error('Shift reminder cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
