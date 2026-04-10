import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { assignmentFormSchema } from '@/lib/validations/assignment'
import { removeStaffFromSlackChannel, sendProjectNotificationIfEnabled, buildMemberRemovedNotification, removeStaffFromProjectUsergroup, resolveSlackUserId } from '@/lib/integrations/slack'

interface RouteParams {
  params: Promise<{ id: string; assignmentId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { assignmentId } = await params
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('project_assignments')
      .select(`
        *,
        staff (*),
        compensation_rules (*)
      `)
      .eq('id', assignmentId)
      .is('deleted_at', null)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'アサインが見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET assignment error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { assignmentId } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const parsed = assignmentFormSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (parsed.data.role_title !== undefined) updateData.role_title = parsed.data.role_title || null
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status
    if (parsed.data.start_date !== undefined) updateData.start_date = parsed.data.start_date
    if (parsed.data.end_date !== undefined) updateData.end_date = parsed.data.end_date || null

    const { data, error } = await supabase
      .from('project_assignments')
      .update(updateData)
      .eq('id', assignmentId)
      .select(`
        *,
        staff (*),
        compensation_rules (*)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PUT assignment error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, assignmentId } = await params
    const supabase = await createServerSupabaseClient()

    // アサイン情報を取得（通知・リムーブ用）
    const { data: assignment } = await supabase
      .from('project_assignments')
      .select('staff_id, staff(last_name, first_name, email)')
      .eq('id', assignmentId)
      .single()

    const { error } = await supabase
      .from('project_assignments')
      .delete()
      .eq('id', assignmentId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Slack通知 + チャンネルリムーブ（バックグラウンド）
    if (assignment?.staff) {
      const staffData = assignment.staff as { last_name?: string; first_name?: string; email?: string }
      const staffName = `${staffData.last_name || ''} ${staffData.first_name || ''}`.trim() || '不明'
      const staffEmail = staffData.email

      const { data: project } = await supabase
        .from('projects')
        .select('name, slack_channel_id')
        .eq('id', projectId)
        .single()

      if (project?.slack_channel_id) {
        // アサイン解除通知（メンション無し）
        const notification = buildMemberRemovedNotification(
          staffName,
          project.name || 'プロジェクト'
        )
        await sendProjectNotificationIfEnabled(
          notification,
          projectId,
          project.slack_channel_id,
          'member_removed',
          { noMention: true }
        )

        // Slackチャンネルからリムーブ
        if (staffEmail) {
          const removeResult = await removeStaffFromSlackChannel(
            staffEmail,
            project.slack_channel_id,
            assignment.staff_id
          )
          if (!removeResult.success && !removeResult.notInChannel) {
            console.warn(
              `Slack channel remove failed for ${staffEmail}:`,
              removeResult.error
            )
          }
        }
      }

      // プロジェクトユーザーグループからも削除（チャンネル有無に関わらず実行）
      if (staffData.email) {
        try {
          const resolved = await resolveSlackUserId(assignment.staff_id, staffData.email)
          if (resolved.slackUserId) {
            await removeStaffFromProjectUsergroup(projectId, resolved.slackUserId)
          }
        } catch (e) {
          console.error('[assignments DELETE] removeStaffFromProjectUsergroup error:', e)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE assignment error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
