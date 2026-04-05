import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { dailyReportSchema, DAILY_REPORT_TYPE_LABELS } from '@/lib/validations/daily-report'
import type { DailyReportType } from '@/lib/validations/daily-report'
import { getProjectAccess } from '@/lib/auth/project-access'
import { sendProjectNotificationIfEnabled, sendSlackBotMessage, type SlackBlock } from '@/lib/integrations/slack'

// ---- GET: 日報一覧取得 ----
export async function GET(request: NextRequest) {
  try {
    const { user, allowedProjectIds, staffId } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // アサインなし → 空配列を返す
    if (allowedProjectIds !== null && allowedProjectIds.length === 0) {
      return NextResponse.json([])
    }

    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const staffIdParam = searchParams.get('staff_id')
    const projectId = searchParams.get('project_id')
    const status = searchParams.get('status')
    const reportType = searchParams.get('report_type')

    let query = supabase
      .from('work_reports')
      .select('*, staff:staff_id(id, last_name, first_name), project:project_id(id, name)')
      .not('report_type', 'is', null)
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: false })

    // オーナー以外はアサイン済みプロジェクトの日報のみ
    if (allowedProjectIds) {
      // training日報はproject_idがnullの場合がある → 自分の日報も含める
      query = query.or(
        `project_id.in.(${allowedProjectIds.join(',')}),and(project_id.is.null,staff_id.eq.${staffId})`
      )
    }

    if (startDate) {
      query = query.gte('report_date', startDate)
    }
    if (endDate) {
      query = query.lte('report_date', endDate)
    }
    if (staffIdParam) {
      query = query.eq('staff_id', staffIdParam)
    }
    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (reportType && reportType !== 'all') {
      query = query.eq('report_type', reportType)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = (data || []).map((report) => ({
      ...report,
      staff_name: (() => {
        const s = report.staff as { last_name?: string; first_name?: string } | null
        return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : ''
      })(),
      project_name: (report.project as { name?: string } | null)?.name || '',
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/reports/daily error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

// ---- POST: 日報作成 ----
export async function POST(request: NextRequest) {
  try {
    const { user, staffId } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (!staffId) {
      return NextResponse.json(
        { error: 'スタッフ情報が見つかりません。管理者にお問い合わせください。' },
        { status: 403 }
      )
    }

    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const parsed = dailyReportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // ベースフィールドとカスタムフィールドを分離
    const { report_type, report_date, project_id, ...customFields } = parsed.data

    // 検索用テキストサマリーを自動生成
    const content = generateContentSummary(report_type, customFields)

    const { data, error } = await supabase
      .from('work_reports')
      .insert({
        staff_id: staffId,
        project_id: project_id || null,
        report_date,
        report_type,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        custom_fields: customFields,
        content,
      })
      .select('*, staff:staff_id(id, last_name, first_name), project:project_id(id, name)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Slack通知（日報提出）
    const staffName = (() => {
      const s = data.staff as { last_name?: string; first_name?: string } | null
      return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : ''
    })()
    const projectName = (data.project as { name?: string } | null)?.name || ''
    const typeLabel = DAILY_REPORT_TYPE_LABELS[report_type as DailyReportType] || '日報'

    if (data.project_id) {
      const { data: proj } = await supabase
        .from('projects')
        .select('slack_channel_id')
        .eq('id', data.project_id)
        .single()

      if (proj?.slack_channel_id) {
        const kpiSummary = buildKpiSummary(report_type, customFields)
        const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvi-portal.vercel.app'
        const result = await sendProjectNotificationIfEnabled(
          {
            text: `${staffName} が ${typeLabel} を提出しました（${projectName}）`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*${staffName}* が *${typeLabel}* を提出しました\n${report_date} | ${projectName}`,
                },
              },
              ...(kpiSummary ? [{
                type: 'context' as const,
                elements: [{ type: 'mrkdwn' as const, text: kpiSummary }],
              }] : []),
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: '承認' },
                    style: 'primary',
                    action_id: 'report_approve',
                    value: data.id,
                  },
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: '差戻し' },
                    style: 'danger',
                    action_id: 'report_reject',
                    value: data.id,
                  },
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: '詳細を見る' },
                    url: `${portalUrl}/reports/work/${data.id}`,
                    action_id: 'report_view',
                  },
                ],
              },
            ],
          },
          data.project_id,
          proj.slack_channel_id,
          'report_submitted',
          { staffId: staffId }
        )

        // slack_thread_ts を保存（スレッド集約用）
        const threadTs = result.ts
        if (threadTs) {
          await supabase
            .from('work_reports')
            .update({ slack_thread_ts: threadTs })
            .eq('id', data.id)

          // スレッド内に報告内容の詳細を投稿
          const detailBlocks = buildReportDetailBlocks(report_type, customFields)
          await sendSlackBotMessage(proj.slack_channel_id, {
            text: `${staffName} の ${typeLabel} 詳細`,
            blocks: detailBlocks,
          }, { thread_ts: threadTs })
        }
      }
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/reports/daily error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

// ---- ヘルパー: KPIサマリー（Slack用） ----
function buildKpiSummary(reportType: string, fields: Record<string, unknown>): string | null {
  switch (reportType) {
    case 'outbound':
      return `架電 ${fields.daily_call_count_actual ?? 0} | 通電 ${fields.daily_contact_count ?? 0} | アポ ${fields.daily_appointment_count ?? 0}`
    case 'inbound':
      return `受電 ${fields.daily_received_count ?? 0} | 完了 ${fields.daily_completed_count ?? 0} | エスカレ ${fields.daily_escalation_count ?? 0}`
    case 'training':
      return fields.study_theme ? `テーマ: ${fields.study_theme}` : null
    default:
      return null
  }
}

// ---- ヘルパー: Slackスレッド用の日報詳細ブロック ----
function buildReportDetailBlocks(
  reportType: string,
  fields: Record<string, unknown>
): SlackBlock[] {
  const blocks: SlackBlock[] = []

  const addSection = (label: string, value: unknown) => {
    if (value && String(value).trim()) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*${label}*\n${String(value)}` },
      })
    }
  }

  switch (reportType) {
    case 'training':
      addSection('自習テーマ', fields.study_theme)
      addSection('スムーズにできた内容', fields.smooth_operations)
      addSection('難しかった内容', fields.difficulties)
      addSection('自力で解決できたこと', fields.self_solved)
      addSection('気づき', fields.awareness)
      addSection('明日の重点項目', fields.tomorrow_focus)
      addSection('上長への質問', fields.questions)
      if (fields.concentration_level) {
        blocks.push({
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `集中度: ${'★'.repeat(Number(fields.concentration_level))}${'☆'.repeat(5 - Number(fields.concentration_level))}` }],
        })
      }
      addSection('体調・コンディション', fields.condition_comment)
      break

    case 'outbound': {
      const callTarget = Number(fields.daily_call_count_target || 0)
      const callActual = Number(fields.daily_call_count_actual || 0)
      const contact = Number(fields.daily_contact_count || 0)
      const appt = Number(fields.daily_appointment_count || 0)
      const contactRate = callActual > 0 ? ((contact / callActual) * 100).toFixed(1) : '0'
      const apptRate = callActual > 0 ? ((appt / callActual) * 100).toFixed(1) : '0'

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*KPI実績*\n架電: ${callActual}件 (目標: ${callTarget})\n通電: ${contact}件 (通電率: ${contactRate}%)\nアポ: ${appt}件 (アポ率: ${apptRate}%)`,
        },
      })
      addSection('自己評価', fields.self_evaluation)
      addSection('トークの工夫', fields.talk_improvements)
      addSection('アポの特徴・傾向', fields.appointment_patterns)
      addSection('断られパターン', fields.rejection_patterns)
      if (fields.tomorrow_call_target || fields.tomorrow_appointment_target) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*明日の目標*\n架電: ${fields.tomorrow_call_target || 0}件 | アポ: ${fields.tomorrow_appointment_target || 0}件`,
          },
        })
      }
      addSection('改善アクション', fields.tomorrow_improvement)
      addSection('エスカレーション', fields.escalation_items)
      addSection('体調・コンディション', fields.condition)
      break
    }

    case 'inbound': {
      const received = Number(fields.daily_received_count || 0)
      const completed = Number(fields.daily_completed_count || 0)
      const escalation = Number(fields.daily_escalation_count || 0)
      const avgTime = fields.daily_avg_handle_time ? `${fields.daily_avg_handle_time}分` : '-'
      const completionRate = received > 0 ? ((completed / received) * 100).toFixed(1) : '0'

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*KPI実績*\n受電: ${received}件\n完了: ${completed}件 (完了率: ${completionRate}%)\nエスカレ: ${escalation}件\n平均対応時間: ${avgTime}`,
        },
      })
      addSection('自己評価', fields.self_evaluation)
      addSection('工夫した点', fields.improvements)
      addSection('よくある問い合わせ', fields.common_inquiries)
      addSection('対応が難しかったケース', fields.difficult_cases)
      addSection('改善アクション', fields.tomorrow_improvement)
      addSection('エスカレーション', fields.escalation_items)
      addSection('体調・コンディション', fields.condition)
      break
    }
  }

  return blocks
}

// ---- ヘルパー: 検索用テキストサマリー生成 ----
function generateContentSummary(
  reportType: string,
  fields: Record<string, unknown>
): string {
  const parts: string[] = []

  switch (reportType) {
    case 'training':
      if (fields.study_theme) parts.push(`自習テーマ: ${fields.study_theme}`)
      if (fields.smooth_operations) parts.push(`スムーズにできた: ${fields.smooth_operations}`)
      if (fields.difficulties) parts.push(`難しかった点: ${fields.difficulties}`)
      if (fields.awareness) parts.push(`気づき: ${fields.awareness}`)
      if (fields.tomorrow_focus) parts.push(`明日の重点: ${fields.tomorrow_focus}`)
      break

    case 'outbound':
      parts.push(`架電数: ${fields.daily_call_count_actual ?? 0}`)
      parts.push(`通電数: ${fields.daily_contact_count ?? 0}`)
      parts.push(`アポ数: ${fields.daily_appointment_count ?? 0}`)
      if (fields.self_evaluation) parts.push(`自己評価: ${fields.self_evaluation}`)
      if (fields.tomorrow_improvement) parts.push(`改善: ${fields.tomorrow_improvement}`)
      break

    case 'inbound':
      parts.push(`受電数: ${fields.daily_received_count ?? 0}`)
      parts.push(`対応完了: ${fields.daily_completed_count ?? 0}`)
      if (fields.self_evaluation) parts.push(`自己評価: ${fields.self_evaluation}`)
      if (fields.tomorrow_improvement) parts.push(`改善: ${fields.tomorrow_improvement}`)
      break
  }

  return parts.join('\n')
}
