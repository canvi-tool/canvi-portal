import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { shiftApprovalSchema } from '@/lib/validations/shift'
import { syncShiftToCalendar } from '@/lib/integrations/google-calendar-sync'
import { canManageProjectShifts } from '@/lib/auth/project-access'
import { sendProjectNotificationIfEnabled, sendSlackBotMessage, getProjectMentionText, type SlackBlock } from '@/lib/integrations/slack'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/shifts/[id]/approve - シフトを承認 (SUBMITTED → APPROVED)
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    const supabase = await createServerSupabaseClient()

    // 現在のシフトを確認（project_idも取得して権限チェックに使用）
    const { data: shift, error: fetchError } = await supabase
      .from('shifts')
      .select('id, status, project_id, staff_id, shift_date, start_time, end_time, shift_type, slack_thread_ts, staff:staff_id(id, last_name, first_name), project:project_id(id, name, slack_channel_id)')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !shift) {
      return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
    }

    // 認証・権限チェック: オーナーまたはアサイン済み管理者のみ承認可能
    const { user: currentUser, canManage } = await canManageProjectShifts(shift.project_id)
    if (!currentUser || !canManage) {
      return NextResponse.json({ error: 'このプロジェクトのシフトを承認する権限がありません' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))

    const parsed = shiftApprovalSchema.safeParse({ action: 'APPROVE', ...body })
    const comment = parsed.success ? parsed.data.comment : undefined

    if (shift.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: `現在のステータス(${shift.status})では承認できません。提出済みのシフトのみ承認可能です。` },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // ステータスを APPROVED に更新（ステータスもWHERE条件に含めて競合防止）
    const { data, error } = await supabase
      .from('shifts')
      .update({
        status: 'APPROVED',
        approved_at: now,
        approved_by: currentUser.id,
        approval_comment: comment || null,
        updated_at: now,
      })
      .eq('id', id)
      .eq('status', 'SUBMITTED')
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 承認履歴に記録
    await supabase.from('shift_approval_history').insert({
      shift_id: id,
      action: 'APPROVE',
      comment: comment || null,
      performed_by: currentUser.id,
    })

    // 承認時にGoogleカレンダー同期
    if (data?.id) {
      try {
        await syncShiftToCalendar(data.id)
      } catch (e) {
        console.error('Calendar sync on approve failed:', e)
      }
    }

    // Slack通知（承認） — スレッドにリプライ
    const staffName = (() => {
      const s = shift.staff as { last_name?: string; first_name?: string } | null
      return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : ''
    })()
    const project = shift.project as { id?: string; name?: string; slack_channel_id?: string } | null
    const projectName = project?.name || ''
    const slackChannelId = project?.slack_channel_id

    if (slackChannelId && shift.project_id) {
      const threadTs = (shift.slack_thread_ts as string | null)

      if (threadTs) {
        // スレッド内にリプライ
        const mentionText = await getProjectMentionText(shift.project_id, shift.staff_id)
        const threadBlocks: SlackBlock[] = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ ${projectName}｜*${staffName}* のシフトが *承認* されました\n👤 承認者: <@${currentUser.id}>\n🕐 ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
            },
          },
        ]
        if (comment) {
          threadBlocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: `💬 コメント: ${comment}` },
          })
        }
        if (mentionText) {
          threadBlocks.push({
            type: 'context',
            elements: [{ type: 'mrkdwn', text: mentionText }],
          })
        }

        await sendSlackBotMessage(slackChannelId, {
          text: `✅ ${projectName}｜${staffName}のシフトが承認されました`,
          blocks: threadBlocks,
        }, { thread_ts: threadTs })
      } else {
        // スレッドがない場合は新規メッセージで通知
        await sendProjectNotificationIfEnabled(
          {
            text: `✅ ${projectName}｜${staffName}のシフトが承認されました`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `✅ *${staffName}* のシフトが *承認* されました\n📆 ${shift.shift_date} | ⏰ ${shift.start_time}〜${shift.end_time} | 🏢 ${projectName}`,
                },
              },
              ...(comment ? [{
                type: 'section' as const,
                text: { type: 'mrkdwn' as const, text: `💬 コメント: ${comment}` },
              }] : []),
            ],
          },
          shift.project_id,
          slackChannelId,
          'shift_approved',
          { staffId: shift.staff_id }
        )
      }
    }

    return NextResponse.json({
      ...data,
      message: 'シフトを承認しました',
    })
  } catch (error) {
    console.error('POST /api/shifts/[id]/approve error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
