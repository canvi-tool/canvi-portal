import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { dailyReportSchema, workReportApprovalSchema, DAILY_REPORT_TYPE_LABELS } from '@/lib/validations/daily-report'
import type { DailyReportType } from '@/lib/validations/daily-report'
import { getProjectAccess } from '@/lib/auth/project-access'
import { isAdmin } from '@/lib/auth/rbac'
import { sendProjectNotificationIfEnabled, sendSlackBotMessage, updateSlackBotMessage, getProjectMentionText, type SlackBlock } from '@/lib/integrations/slack'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ---- GET: 日報詳細取得 ----
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('work_reports')
      .select('*, staff:staff_id(id, last_name, first_name, email), project:project_id(id, name)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '日報が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ...data,
      staff_name: (() => {
        const s = data.staff as { last_name?: string; first_name?: string } | null
        return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : ''
      })(),
      project_name: (data.project as { name?: string } | null)?.name || '',
    })
  } catch (error) {
    console.error('GET /api/reports/daily/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

// ---- PUT: 日報更新（下書き・差戻しのみ編集可） ----
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, staffId } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const isDraft = searchParams.get('draft') === '1'

    // 既存レコードを取得してステータスチェック
    const { data: existing, error: fetchError } = await supabase
      .from('work_reports')
      .select('id, status, staff_id, project_id, slack_thread_ts')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: '日報が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // 承認済みは編集不可（二重防御）
    if (existing.status === 'approved') {
      return NextResponse.json(
        { error: '承認済みの日報は編集できません' },
        { status: 400 }
      )
    }
    // draft/rejected/submitted のみ編集可能
    if (
      existing.status !== 'draft' &&
      existing.status !== 'rejected' &&
      existing.status !== 'submitted'
    ) {
      return NextResponse.json(
        { error: 'この日報は編集できません' },
        { status: 400 }
      )
    }

    // 自分の日報のみ編集可能（管理者は除く）
    if (!isAdmin(user) && existing.staff_id !== staffId) {
      return NextResponse.json({ error: '他のスタッフの日報は編集できません' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = dailyReportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { report_type, report_date, project_id, ...customFields } = parsed.data

    // 検索用テキストサマリーを再生成
    const content = generateContentSummary(report_type, customFields)

    const { data, error } = await supabase
      .from('work_reports')
      .update({
        project_id: project_id || null,
        report_date,
        report_type,
        status: isDraft ? 'draft' : 'submitted',
        submitted_at: isDraft ? null : new Date().toISOString(),
        custom_fields: customFields,
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, staff:staff_id(id, last_name, first_name), project:project_id(id, name)')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '日報が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 提出済を修正した場合: 前回のSlack通知を「差戻し」に書き換え（ボタン削除）
    const editStaffName = (() => {
      const s = data.staff as { last_name?: string; first_name?: string } | null
      return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : ''
    })()
    if (existing.status === 'submitted' && existing.slack_thread_ts && existing.project_id) {
      try {
        const { data: proj } = await supabase
          .from('projects')
          .select('slack_channel_id, name')
          .eq('id', existing.project_id)
          .single()
        if (proj?.slack_channel_id) {
          const editProjectName = proj.name || ''
          await updateSlackBotMessage(
            proj.slack_channel_id,
            existing.slack_thread_ts,
            {
              text: `${editProjectName ? `${editProjectName}｜` : ''}${editStaffName}の日報が修正のため差し戻されました`,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `:leftwards_arrow_with_hook: ${editProjectName ? `${editProjectName}｜` : ''}${editStaffName} の日報が修正のため差し戻されました\n提出者が内容を修正中です。`,
                  },
                },
              ],
            }
          )
        }
      } catch (e) {
        console.warn('Failed to update prior Slack message (daily):', e)
      }
      // 旧スレッドTSをクリアして新規通知させる
      await supabase
        .from('work_reports')
        .update({ slack_thread_ts: null })
        .eq('id', id)
    }

    // Slack通知（初回提出 or 再提出 → 既存スレッドにリプライ or 新規トップレベル）
    if (!isDraft && (existing.status === 'draft' || existing.status === 'rejected' || existing.status === 'submitted') && data.project_id) {
      const staffName = (() => {
        const s = data.staff as { last_name?: string; first_name?: string } | null
        return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : ''
      })()
      const projectName = (data.project as { name?: string } | null)?.name || ''
      const typeLabel = DAILY_REPORT_TYPE_LABELS[report_type as DailyReportType] || '日報'
      const isFirstSubmission = existing.status === 'draft'
      const actionLabel = isFirstSubmission ? '提出' : '再提出'

      const { data: proj } = await supabase
        .from('projects')
        .select('slack_channel_id')
        .eq('id', data.project_id)
        .single()

      if (proj?.slack_channel_id) {
        // 既存の slack_thread_ts を取得
        const { data: reportWithThread } = await supabase
          .from('work_reports')
          .select('slack_thread_ts')
          .eq('id', id)
          .single()

        const existingThreadTs = reportWithThread?.slack_thread_ts as string | null

        if (existingThreadTs) {
          // 既存スレッドにリプライ（再提出通知 + ボタン付き）
          const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvi-portal.vercel.app'
          const kpiSummary = buildKpiSummary(report_type, customFields)
          const mentionText = await getProjectMentionText(data.project_id, data.staff_id)

          await sendSlackBotMessage(proj.slack_channel_id, {
            text: `${projectName}｜${staffName}の${typeLabel}が${actionLabel}されました`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `${staffName} が ${typeLabel} を ${actionLabel} しました\n${report_date} | ${projectName}`,
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
              ...(mentionText ? [{ type: 'context' as const, elements: [{ type: 'mrkdwn' as const, text: mentionText }] }] : []),
            ],
          }, { thread_ts: existingThreadTs, reply_broadcast: true })

          // スレッド内に報告内容の詳細を投稿
          const detailBlocks = buildReportDetailBlocks(report_type, customFields, staffName, report_date)
          await sendSlackBotMessage(proj.slack_channel_id, {
            text: `${projectName}｜${staffName}の${typeLabel}詳細`,
            blocks: detailBlocks,
          }, { thread_ts: existingThreadTs })
        } else {
          // slack_thread_ts がない場合は新規トップレベルメッセージ（初回提出 or フォールバック）
          const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvi-portal.vercel.app'
          const kpiSummary = buildKpiSummary(report_type, customFields)

          const result = await sendProjectNotificationIfEnabled(
            {
              text: `${projectName}｜${staffName}の${typeLabel}が${actionLabel}されました`,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `${staffName} が ${typeLabel} を ${actionLabel} しました\n${report_date} | ${projectName}`,
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
            { staffId: data.staff_id }
          )

          if (result.ts) {
            await supabase
              .from('work_reports')
              .update({ slack_thread_ts: result.ts })
              .eq('id', data.id)

            const detailBlocks = buildReportDetailBlocks(report_type, customFields, staffName, report_date)
            await sendSlackBotMessage(proj.slack_channel_id, {
              text: `${projectName}｜${staffName}の${typeLabel}詳細`,
              blocks: detailBlocks,
            }, { thread_ts: result.ts })
          }
        }
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PUT /api/reports/daily/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

// ---- PATCH: 承認・差戻し（管理者のみ） ----
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: '承認権限がありません' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const parsed = workReportApprovalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    }

    if (parsed.data.status === 'approved') {
      updateData.approved_at = new Date().toISOString()
      updateData.approved_by = user.id
    }

    if (parsed.data.comment) {
      updateData.approval_comment = parsed.data.comment
    }

    const { data, error } = await supabase
      .from('work_reports')
      .update(updateData)
      .eq('id', id)
      .select('*, staff:staff_id(id, last_name, first_name), project:project_id(id, name)')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '日報が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Slack通知（承認/差戻し → スレッドにリプライ）
    const staffName = (() => {
      const s = data.staff as { last_name?: string; first_name?: string } | null
      return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : ''
    })()
    const projectName = (data.project as { name?: string } | null)?.name || ''
    const typeLabel = DAILY_REPORT_TYPE_LABELS[data.report_type as DailyReportType] || '日報'
    const isApproved = parsed.data.status === 'approved'

    if (data.project_id) {
      const { data: proj } = await supabase
        .from('projects')
        .select('slack_channel_id')
        .eq('id', data.project_id)
        .single()

      if (proj?.slack_channel_id) {
        const action = isApproved ? '承認' : '差戻し'
        const slackThreadTs = data.slack_thread_ts as string | null

        if (slackThreadTs) {
          // 既存スレッドにリプライ
          const mentionText = await getProjectMentionText(data.project_id, data.staff_id)
          await sendSlackBotMessage(proj.slack_channel_id, {
            text: `${projectName}｜${staffName}の${typeLabel}が${action}されました`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `${staffName} の ${typeLabel} が ${action} されました\n${data.report_date} | ${projectName}${parsed.data.comment ? `\nコメント: ${parsed.data.comment}` : ''}`,
                },
              },
              ...(mentionText ? [{ type: 'context' as const, elements: [{ type: 'mrkdwn' as const, text: mentionText }] }] : []),
            ],
          }, { thread_ts: slackThreadTs, reply_broadcast: true })
        } else {
          // フォールバック: slack_thread_ts がない場合は従来通りトップレベル
          await sendProjectNotificationIfEnabled(
            {
              text: `${projectName}｜${staffName}の${typeLabel}が${action}されました`,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `${staffName} の ${typeLabel} が ${action} されました\n${data.report_date} | ${projectName}${parsed.data.comment ? `\nコメント: ${parsed.data.comment}` : ''}`,
                  },
                },
              ],
            },
            data.project_id,
            proj.slack_channel_id,
            'report_submitted',
            { staffId: data.staff_id }
          )
        }
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PATCH /api/reports/daily/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

// ---- DELETE: 論理削除 ----
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { user, staffId } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createServerSupabaseClient()

    // 既存レコードを取得して権限チェック
    const { data: existing, error: fetchError } = await supabase
      .from('work_reports')
      .select('id, staff_id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: '日報が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // 自分の日報のみ削除可能（管理者は除く）
    if (!isAdmin(user) && existing.staff_id !== staffId) {
      return NextResponse.json({ error: '他のスタッフの日報は削除できません' }, { status: 403 })
    }

    // 承認済みは削除不可
    if (existing.status === 'approved') {
      return NextResponse.json(
        { error: '承認済みの日報は削除できません' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('work_reports')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/reports/daily/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
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
      if (fields.tomorrow_focus) parts.push(`次回の重点: ${fields.tomorrow_focus}`)
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

    case 'leon_is':
      parts.push(`Slack通知対象数: ${fields.slack_notified_count ?? 0}`)
      parts.push(`即時架電: ${fields.immediate_call_count ?? 0}`)
      parts.push(`通常架電: ${fields.followup_call_count ?? 0}`)
      parts.push(`受電: ${fields.received_call_count ?? 0}`)
      parts.push(`契約/伴走: ${fields.contract_zoom_count ?? 0}`)
      if (fields.self_evaluation) parts.push(`自己評価: ${fields.self_evaluation}`)
      if (fields.current_issues) parts.push(`課題: ${fields.current_issues}`)
      if (fields.issue_improvements) parts.push(`改善: ${fields.issue_improvements}`)
      break
  }

  return parts.join('\n')
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
    case 'leon_is':
      return `Slack通知 ${fields.slack_notified_count ?? 0} | 即時 ${fields.immediate_call_count ?? 0} | 追客 ${fields.followup_call_count ?? 0} | 受電 ${fields.received_call_count ?? 0} | 契約/伴走 ${fields.contract_zoom_count ?? 0}`
    default:
      return null
  }
}

// ---- ヘルパー: Slackスレッド用の日報詳細ブロック ----
function buildReportDetailBlocks(
  reportType: string,
  fields: Record<string, unknown>,
  staffName?: string,
  reportDate?: string
): SlackBlock[] {
  const blocks: SlackBlock[] = []

  // メンバー名ヘッダーを先頭に追加
  if (staffName) {
    const dateStr = reportDate || ''
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📋 ${staffName} の日次報告${dateStr ? `（${dateStr}）` : ''}`,
      },
    })
    blocks.push({ type: 'divider' })
  }

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
      addSection('次回の重点項目', fields.tomorrow_focus)
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
            text: `*次回の目標*\n架電: ${fields.tomorrow_call_target || 0}件 | アポ: ${fields.tomorrow_appointment_target || 0}件`,
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

    case 'leon_is': {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*定量*\nSlack通知対象数: ${fields.slack_notified_count ?? 0}件\n即時架電: ${fields.immediate_call_count ?? 0}件\n通常架電: ${fields.followup_call_count ?? 0}件\n受電: ${fields.received_call_count ?? 0}件\n契約入金/伴走: ${fields.contract_zoom_count ?? 0}件`,
        },
      })
      addSection('自己評価', fields.self_evaluation)
      addSection('現状の課題', fields.current_issues)
      addSection('課題に対しての改善', fields.issue_improvements)
      addSection('困っていること・相談事', fields.consultations)
      if (fields.concentration_level) {
        blocks.push({
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `集中度: ${'★'.repeat(Number(fields.concentration_level))}${'☆'.repeat(5 - Number(fields.concentration_level))}` }],
        })
      }
      addSection('体調・コンディション', fields.condition_comment)
      break
    }
  }

  return blocks
}
