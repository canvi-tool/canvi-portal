import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { shiftApprovalSchema } from '@/lib/validations/shift'
import { getCurrentUser } from '@/lib/auth/rbac'
import { sendProjectNotificationIfEnabled, sendSlackBotMessage, getProjectMentionText, type SlackBlock } from '@/lib/integrations/slack'
import { syncShiftToCalendar } from '@/lib/integrations/google-calendar-sync'

interface RouteParams {
  params: Promise<{ id: string }>
}

const SHIFT_TYPE_LABELS: Record<string, string> = {
  WORK: '通常勤務',
  PAID_LEAVE: '有給休暇',
  ABSENCE: '欠勤',
  HALF_DAY_LEAVE: '半休',
  SPECIAL_LEAVE: '特別休暇',
}

// POST /api/shifts/[id]/submit - シフトを提出 (DRAFT → SUBMITTED)
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const parsed = shiftApprovalSchema.safeParse({ action: 'COMMENT', ...body })
    const comment = parsed.success ? parsed.data.comment : undefined

    // 認証チェック
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()

    // 現在のシフトを確認（スタッフ・プロジェクト情報も取得）
    const { data: shift, error: fetchError } = await supabase
      .from('shifts')
      .select('id, status, staff_id, project_id, shift_date, start_time, end_time, shift_type, notes, slack_thread_ts, staff:staff_id(id, last_name, first_name), project:project_id(id, name, slack_channel_id)')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !shift) {
      return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
    }

    // NEEDS_REVISION のみ再提出可能（新規作成時はすでに SUBMITTED）
    if (shift.status !== 'NEEDS_REVISION') {
      return NextResponse.json(
        { error: `現在のステータス(${shift.status})では提出できません` },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const isResubmit = shift.status === 'NEEDS_REVISION'

    // 自分のシフトのみ提出可能（管理者・オーナーは他人のシフトも提出可能）
    if (shift.staff_id !== currentUser.staffId && !currentUser.roles.includes('owner') && !currentUser.roles.includes('admin')) {
      return NextResponse.json({ error: 'このシフトを提出する権限がありません' }, { status: 403 })
    }

    // ステータスを SUBMITTED に更新（ステータスもWHERE条件に含めて競合防止）
    const { data, error } = await supabase
      .from('shifts')
      .update({
        status: 'SUBMITTED',
        submitted_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .eq('status', 'NEEDS_REVISION')
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Googleカレンダー同期（申請時点でGCalにイベント作成/更新）
    try {
      await syncShiftToCalendar(id)
    } catch (e) {
      console.error('Calendar sync on submit failed:', e)
    }

    // 承認履歴に記録
    if (comment) {
      await supabase.from('shift_approval_history').insert({
        shift_id: id,
        action: 'COMMENT',
        comment,
        performed_by: currentUser.id,
      })
    }

    // Slack通知（シフト提出）
    const staffName = (() => {
      const s = shift.staff as { last_name?: string; first_name?: string } | null
      return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : ''
    })()
    const project = shift.project as { id?: string; name?: string; slack_channel_id?: string } | null
    const projectName = project?.name || ''
    const slackChannelId = project?.slack_channel_id
    const shiftTypeLabel = SHIFT_TYPE_LABELS[shift.shift_type || 'WORK'] || 'シフト'
    const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvi-portal.vercel.app'

    if (slackChannelId && shift.project_id) {
      const existingThreadTs = shift.slack_thread_ts as string | null

      if (isResubmit && existingThreadTs) {
        // 再提出 → 既存スレッドにリプライ
        const mentionText = await getProjectMentionText(shift.project_id, shift.staff_id)
        const resubmitBlocks: SlackBlock[] = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🔄 ${staffName} がシフトを再提出しました\n📅 ${shift.shift_date} | ⏰ ${shift.start_time}〜${shift.end_time} | 🏢 ${projectName}`,
            },
          },
        ]
        if (shift.notes) {
          resubmitBlocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: `📝 備考: ${shift.notes}` },
          })
        }
        if (comment) {
          resubmitBlocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: `💬 コメント: ${comment}` },
          })
        }
        if (mentionText) {
          resubmitBlocks.push({
            type: 'context',
            elements: [{ type: 'mrkdwn', text: mentionText }],
          })
        }
        resubmitBlocks.push({
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '✅ 承認' },
              style: 'primary',
              action_id: 'shift_approve',
              value: id,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '🔙 差戻し' },
              style: 'danger',
              action_id: 'shift_reject',
              value: id,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '📄 詳細' },
              url: `${portalUrl}/shifts`,
              action_id: 'shift_view',
            },
          ],
        })

        await sendSlackBotMessage(slackChannelId, {
          text: `🔄 ${projectName}｜${staffName}のシフトが再提出されました`,
          blocks: resubmitBlocks,
        }, { thread_ts: existingThreadTs })
      } else {
        // 新規提出 → 新しいメッセージ（ボタン付き）
        const result = await sendProjectNotificationIfEnabled(
          {
            text: `📅 ${projectName}｜${staffName}のシフトが申請されました`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `📅 ${staffName} がシフトを申請しました\n📆 ${shift.shift_date} | ⏰ ${shift.start_time}〜${shift.end_time} | 🏢 ${projectName}`,
                },
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: '✅ 承認' },
                    style: 'primary',
                    action_id: 'shift_approve',
                    value: id,
                  },
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: '🔙 差戻し' },
                    style: 'danger',
                    action_id: 'shift_reject',
                    value: id,
                  },
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: '📄 詳細' },
                    url: `${portalUrl}/shifts`,
                    action_id: 'shift_view',
                  },
                ],
              },
            ],
          },
          shift.project_id,
          slackChannelId,
          'shift_submitted',
          { staffId: shift.staff_id }
        )

        // slack_thread_ts を保存
        const threadTs = result.ts
        if (threadTs) {
          await supabase
            .from('shifts')
            .update({ slack_thread_ts: threadTs })
            .eq('id', id)

          // スレッド内にシフト詳細を投稿
          const detailBlocks: SlackBlock[] = [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*📋 シフト詳細*\n👤 ${staffName}\n📆 日付: ${shift.shift_date}\n⏰ 時間: ${shift.start_time}〜${shift.end_time}\n📝 種別: ${shiftTypeLabel}`,
              },
            },
          ]
          if (shift.notes) {
            detailBlocks.push({
              type: 'section',
              text: { type: 'mrkdwn', text: `📝 備考: ${shift.notes}` },
            })
          }
          await sendSlackBotMessage(slackChannelId, {
            text: `📋 ${projectName}｜${staffName}のシフト詳細`,
            blocks: detailBlocks,
          }, { thread_ts: threadTs })
        }
      }
    }

    return NextResponse.json({
      ...data,
      message: 'シフトを提出しました',
    })
  } catch (error) {
    console.error('POST /api/shifts/[id]/submit error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
