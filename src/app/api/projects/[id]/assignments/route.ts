import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { assignmentFormSchema } from '@/lib/validations/assignment'
import { inviteStaffToSlackChannel, sendProjectNotificationIfEnabled, buildMemberAssignedNotification } from '@/lib/integrations/slack'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('project_assignments')
      .select(`
        *,
        staff (*),
        compensation_rules (*)
      `)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('GET /api/projects/[id]/assignments error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const parsed = assignmentFormSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Check for duplicate assignment
    const { data: existing } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('project_id', projectId)
      .eq('staff_id', parsed.data.staff_id)
      .is('deleted_at', null)
      .in('status', ['proposed', 'confirmed', 'in_progress'])
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'このスタッフは既にこのプロジェクトにアサインされています' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('project_assignments')
      .insert({
        project_id: projectId,
        staff_id: parsed.data.staff_id,
        role_title: parsed.data.role_title || null,
        status: parsed.data.status,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date || null,
      })
      .select(`
        *,
        staff (*),
        compensation_rules (*)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // --- Slack連携: チャンネル招待 + アサイン通知 ---
    // バックグラウンドで実行（レスポンスを遅延させない）
    const staffData = data.staff as { last_name?: string; first_name?: string; email?: string } | null
    const staffEmail = staffData?.email
    const staffName = staffData ? `${staffData.last_name || ''} ${staffData.first_name || ''}`.trim() || '不明' : '不明'

    // プロジェクト情報を取得（Slackチャンネル情報含む）
    const { data: project } = await supabase
      .from('projects')
      .select('name, slack_channel_id, slack_channel_name')
      .eq('id', projectId)
      .single()

    if (project?.slack_channel_id && staffEmail) {
      // Slackチャンネルにスタッフを招待（staffId渡しでSlack User IDを永続化）
      const inviteResult = await inviteStaffToSlackChannel(
        staffEmail,
        project.slack_channel_id,
        parsed.data.staff_id
      )
      if (!inviteResult.success && !inviteResult.alreadyInChannel) {
        console.warn(
          `Slack channel invite failed for ${staffEmail} to ${project.slack_channel_name}:`,
          inviteResult.error
        )
      }
    }

    // アサイン通知を送信
    if (project?.slack_channel_id) {
      const notification = buildMemberAssignedNotification(
        staffName,
        project.name || 'プロジェクト',
        parsed.data.role_title || undefined
      )
      await sendProjectNotificationIfEnabled(
        notification,
        projectId,
        project.slack_channel_id,
        'member_assigned',
        { staffId: parsed.data.staff_id }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects/[id]/assignments error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
