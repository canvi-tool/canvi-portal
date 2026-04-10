import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { inviteStaffToSlackChannel, sendProjectNotificationIfEnabled, buildBulkMemberAssignedNotification, syncProjectUsergroup } from '@/lib/integrations/slack'
import { z } from 'zod'
import { ASSIGNMENT_STATUS_TO_DB } from '@/lib/validations/assignment'

const bulkAssignSchema = z.object({
  staff_ids: z.array(z.string().uuid()).min(1),
  role_title: z.string().max(200).optional().or(z.literal('')),
  status: z.enum(['proposed', 'active', 'ended']),
  start_date: z.string().min(1),
  end_date: z.string().optional().or(z.literal('')),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const parsed = bulkAssignSchema.safeParse(body)
    if (!parsed.success) {
      const flat = parsed.error.flatten()
      console.error('[POST /assignments/bulk] validation error', { body, flat })
      // 最初のフィールドエラーをユーザーに表示
      const firstField = Object.entries(flat.fieldErrors)[0]
      const friendly = firstField
        ? `${firstField[0]}: ${(firstField[1] as string[])?.[0] || ''}`
        : 'バリデーションエラー'
      return NextResponse.json(
        { error: friendly, details: flat },
        { status: 400 }
      )
    }

    const { staff_ids, role_title, status: rawStatus, start_date, end_date } = parsed.data
    const status = ASSIGNMENT_STATUS_TO_DB[rawStatus] || rawStatus
    const createdAssignments: unknown[] = []
    const skippedIds: string[] = []
    const staffNames: string[] = []

    // プロジェクト情報を取得（Slackチャンネル情報含む）
    const { data: project } = await supabase
      .from('projects')
      .select('name, slack_channel_id, slack_channel_name')
      .eq('id', projectId)
      .single()

    for (const staffId of staff_ids) {
      // アクティブな重複チェック
      const { data: activeExisting } = await supabase
        .from('project_assignments')
        .select('id')
        .eq('project_id', projectId)
        .eq('staff_id', staffId)
        .is('deleted_at', null)
        .in('status', ['proposed', 'confirmed', 'in_progress'])
        .maybeSingle()

      if (activeExisting) {
        skippedIds.push(staffId)
        continue
      }

      // ソフト削除済み or 同じ start_date の旧レコードがあれば復活させる
      // (UNIQUE(project_id, staff_id, start_date) 制約のため同一start_dateの再insert不可)
      const { data: existingByKey } = await supabase
        .from('project_assignments')
        .select('id, deleted_at')
        .eq('project_id', projectId)
        .eq('staff_id', staffId)
        .eq('start_date', start_date)
        .maybeSingle()

      let data: { id: string; staff: unknown } | null = null
      let error: { message: string } | null = null

      if (existingByKey) {
        const restored = await supabase
          .from('project_assignments')
          .update({
            role_title: role_title || null,
            status,
            end_date: end_date || null,
            deleted_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingByKey.id)
          .select(`
            *,
            staff (*),
            compensation_rules (*)
          `)
          .single()
        data = restored.data
        error = restored.error
      } else {
        const inserted = await supabase
          .from('project_assignments')
          .insert({
            project_id: projectId,
            staff_id: staffId,
            role_title: role_title || null,
            status,
            start_date,
            end_date: end_date || null,
          })
          .select(`
            *,
            staff (*),
            compensation_rules (*)
          `)
          .single()
        data = inserted.data
        error = inserted.error
      }

      if (error || !data) {
        console.error(`Failed to upsert assignment for staff ${staffId}:`, error?.message)
        continue
      }

      createdAssignments.push(data)

      // Slackチャンネルにスタッフを招待
      const staffData = data.staff as { last_name?: string; first_name?: string; email?: string } | null
      const staffEmail = staffData?.email
      const staffName = staffData ? `${staffData.last_name || ''} ${staffData.first_name || ''}`.trim() || '不明' : '不明'
      staffNames.push(staffName)

      if (project?.slack_channel_id && staffEmail) {
        const inviteResult = await inviteStaffToSlackChannel(
          staffEmail,
          project.slack_channel_id,
          staffId
        )
        if (!inviteResult.success && !inviteResult.alreadyInChannel) {
          console.warn(
            `Slack channel invite failed for ${staffEmail} to ${project.slack_channel_name}:`,
            inviteResult.error
          )
        }
      }
    }

    // 全アサイン完了後、プロジェクトユーザーグループをフル同期（チャンネル有無に関わらず実行）
    if (staffNames.length > 0) {
      try {
        await syncProjectUsergroup(projectId)
      } catch (e) {
        console.error('[assignments/bulk] syncProjectUsergroup error:', e)
      }
    }

    // 全アサイン完了後、1つの通知を送信
    if (staffNames.length > 0 && project?.slack_channel_id) {
      const notification = buildBulkMemberAssignedNotification(
        staffNames,
        project.name || 'プロジェクト',
        role_title || undefined
      )
      await sendProjectNotificationIfEnabled(
        notification,
        projectId,
        project.slack_channel_id,
        'member_assigned',
        { noMention: true }
      )
    }

    return NextResponse.json(
      {
        created: createdAssignments.length,
        skipped: skippedIds.length,
        assignments: createdAssignments,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/projects/[id]/assignments/bulk error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
