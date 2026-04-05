import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { dailyReportSchema, workReportApprovalSchema, DAILY_REPORT_TYPE_LABELS } from '@/lib/validations/daily-report'
import type { DailyReportType } from '@/lib/validations/daily-report'
import { getProjectAccess } from '@/lib/auth/project-access'
import { isAdmin } from '@/lib/auth/rbac'
import { sendProjectNotificationIfEnabled } from '@/lib/integrations/slack'

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

    // 既存レコードを取得してステータスチェック
    const { data: existing, error: fetchError } = await supabase
      .from('work_reports')
      .select('id, status, staff_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: '日報が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // 下書き・差戻しのみ編集可能
    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      return NextResponse.json(
        { error: '提出済みまたは承認済みの日報は編集できません' },
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
        status: 'submitted',
        submitted_at: new Date().toISOString(),
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

    // Slack通知（承認/差戻し）
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
        const emoji = isApproved ? '✅' : '🔙'
        const action = isApproved ? '承認' : '差戻し'
        await sendProjectNotificationIfEnabled(
          {
            text: `${emoji} ${staffName} の ${typeLabel} が${action}されました（${projectName}）`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `${emoji} *${staffName}* の *${typeLabel}* が *${action}* されました\n📅 ${data.report_date} | 🏢 ${projectName}${parsed.data.comment ? `\n💬 ${parsed.data.comment}` : ''}`,
                },
              },
            ],
          },
          data.project_id,
          proj.slack_channel_id,
          'report_submitted',
          { noMention: true }
        )
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
