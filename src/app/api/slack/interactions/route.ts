import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Slack sends interaction payloads as form-urlencoded with a "payload" field
    const formData = await request.formData()
    const payloadStr = formData.get('payload') as string
    if (!payloadStr) {
      return NextResponse.json({ error: 'No payload' }, { status: 400 })
    }

    const payload = JSON.parse(payloadStr)

    // Handle block_actions → open modal for comment input
    if (payload.type === 'block_actions') {
      const action = payload.actions?.[0]
      if (!action) return new Response('', { status: 200 })

      const actionId = action.action_id // 'report_approve' or 'report_reject'
      const reportId = action.value // the report ID

      if (!['report_approve', 'report_reject'].includes(actionId)) {
        return new Response('', { status: 200 })
      }

      // Open modal for comment input
      const botToken = process.env.SLACK_BOT_TOKEN
      if (!botToken) return new Response('', { status: 200 })

      const isApprove = actionId === 'report_approve'
      const modalTitle = isApprove ? '日報を承認' : '日報を差戻し'
      const submitText = isApprove ? '承認する' : '差戻しする'

      await fetch('https://slack.com/api/views.open', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trigger_id: payload.trigger_id,
          view: {
            type: 'modal',
            callback_id: isApprove ? 'report_approve_modal' : 'report_reject_modal',
            private_metadata: JSON.stringify({
              reportId,
              channelId: payload.channel?.id,
              messageTs: payload.message?.ts,
            }),
            title: { type: 'plain_text', text: modalTitle },
            submit: { type: 'plain_text', text: submitText },
            close: { type: 'plain_text', text: 'キャンセル' },
            blocks: [
              {
                type: 'input',
                block_id: 'comment_block',
                optional: true,
                element: {
                  type: 'plain_text_input',
                  action_id: 'comment_input',
                  multiline: true,
                  placeholder: { type: 'plain_text', text: 'コメントを入力（任意）' },
                },
                label: { type: 'plain_text', text: '💬 コメント' },
              },
            ],
          },
        }),
      })

      return new Response('', { status: 200 })
    }

    // Handle view_submission → process the approval/rejection with comment
    if (payload.type === 'view_submission') {
      const callbackId = payload.view?.callback_id
      if (!['report_approve_modal', 'report_reject_modal'].includes(callbackId)) {
        return new Response('', { status: 200 })
      }

      const isApprove = callbackId === 'report_approve_modal'
      const metadata = JSON.parse(payload.view?.private_metadata || '{}')
      const { reportId, channelId, messageTs } = metadata
      const comment = payload.view?.state?.values?.comment_block?.comment_input?.value || ''
      const slackUserId = payload.user?.id

      // Use admin client to update the report
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Fetch the report
      const { data: report, error: fetchError } = await supabase
        .from('work_reports')
        .select('id, status, report_type, report_date, staff_id, project_id, staff:staff_id(last_name, first_name), project:project_id(name)')
        .eq('id', reportId)
        .single()

      if (fetchError || !report) {
        // Update the Slack message to show error
        await updateSlackMessageDirect(channelId, messageTs, '❌ 日報が見つかりません')
        return new Response('', { status: 200 })
      }

      // Check if already processed
      if (report.status === 'approved' || report.status === 'rejected') {
        const statusLabel = report.status === 'approved' ? '承認済み' : '差戻し済み'
        await updateSlackMessageDirect(channelId, messageTs, `⚠️ この日報は既に${statusLabel}です`)
        return new Response('', { status: 200 })
      }

      const newStatus = isApprove ? 'approved' : 'rejected'

      // Find the staff record for the Slack user who clicked (to set approved_by)
      let approverUserId: string | null = null
      const { data: approverStaff } = await supabase
        .from('staff')
        .select('user_id')
        .or(`custom_fields->slack_user_id.eq.${slackUserId},custom_fields->>slack_user_id.eq.${slackUserId}`)
        .limit(1)
        .single()

      if (approverStaff?.user_id) {
        approverUserId = approverStaff.user_id
      }

      // Check if the Slack user has admin or owner role
      if (!approverUserId) {
        await updateSlackMessageDirect(channelId, messageTs, '❌ 管理者権限が必要です（スタッフが見つかりません）')
        return new Response('', { status: 200 })
      }

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role:roles(name)')
        .eq('user_id', approverUserId)

      const roleNames = (userRoles as { role: { name: string } | null }[] | null)
        ?.map((ur) => ur.role?.name)
        .filter(Boolean) || []

      if (!roleNames.includes('admin') && !roleNames.includes('owner')) {
        await updateSlackMessageDirect(channelId, messageTs, '❌ 管理者権限が必要です')
        return new Response('', { status: 200 })
      }

      // Update the report
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        approval_comment: comment || null,
      }
      if (newStatus === 'approved') {
        updateData.approved_at = new Date().toISOString()
        if (approverUserId) updateData.approved_by = approverUserId
      }

      const { error: updateError } = await supabase
        .from('work_reports')
        .update(updateData)
        .eq('id', reportId)

      if (updateError) {
        await updateSlackMessageDirect(channelId, messageTs, `❌ 更新に失敗しました: ${updateError.message}`)
        return new Response('', { status: 200 })
      }

      // Build updated message
      const staffName = (() => {
        const s = report.staff as { last_name?: string; first_name?: string } | null
        return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : ''
      })()
      const projectName = (report.project as { name?: string } | null)?.name || ''

      const REPORT_TYPE_LABELS: Record<string, string> = {
        training: '研修日報',
        outbound: '架電日報',
        inbound: '受電日報',
      }
      const typeLabel = REPORT_TYPE_LABELS[report.report_type || ''] || '日報'

      const emoji = newStatus === 'approved' ? '✅' : '🔙'
      const actionLabel = newStatus === 'approved' ? '承認' : '差戻し'

      // Update the original Slack message (remove buttons, show result)
      const botToken = process.env.SLACK_BOT_TOKEN
      if (botToken) {
        // Build message blocks
        const messageBlocks: Record<string, unknown>[] = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${emoji} *${staffName}* の *${typeLabel}* が *${actionLabel}* されました\n📅 ${report.report_date} | 🏢 ${projectName}`,
            },
          },
        ]

        // Add comment block if present
        if (comment) {
          messageBlocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `💬 コメント: ${comment}`,
            },
          })
        }

        messageBlocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `${actionLabel}者: <@${slackUserId}> | ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
            },
          ],
        })

        const res = await fetch('https://slack.com/api/chat.update', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: channelId,
            ts: messageTs,
            text: `${emoji} ${staffName} の ${typeLabel} が${actionLabel}されました（${projectName}）`,
            blocks: messageBlocks,
          }),
        })
        const updateResult = await res.json()
        if (!updateResult.ok) {
          console.error('chat.update failed:', updateResult.error)
        }

        // スレッドにリプライ（承認/差戻し詳細）
        // slack_thread_ts を取得（なければ message.ts をフォールバック）
        const { data: reportWithThread } = await supabase
          .from('work_reports')
          .select('slack_thread_ts')
          .eq('id', reportId)
          .single()

        const threadTs = (reportWithThread?.slack_thread_ts as string) || messageTs

        if (threadTs && channelId) {
          // slack_thread_ts が未保存の場合は保存
          if (!reportWithThread?.slack_thread_ts && messageTs) {
            await supabase
              .from('work_reports')
              .update({ slack_thread_ts: messageTs })
              .eq('id', reportId)
          }

          // Build thread reply blocks
          const threadBlocks: Record<string, unknown>[] = [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${emoji} *${actionLabel}* by <@${slackUserId}>\n🕐 ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
              },
            },
          ]

          // Add comment to thread reply if present
          if (comment) {
            threadBlocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `💬 コメント: ${comment}`,
              },
            })
          }

          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${botToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel: channelId,
              thread_ts: threadTs,
              text: `${emoji} ${actionLabel}されました`,
              blocks: threadBlocks,
            }),
          })
        }
      }

      return new Response('', { status: 200 })
    }

    // Unknown payload type
    return new Response('', { status: 200 })
  } catch (error) {
    console.error('Slack interaction error:', error)
    return new Response('', { status: 200 }) // Always return 200 to Slack
  }
}

// Helper to update a Slack message using channel/ts directly (for view_submission where payload structure differs)
async function updateSlackMessageDirect(channelId: string, messageTs: string, text: string) {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) return

  await fetch('https://slack.com/api/chat.update', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
      ts: messageTs,
      text,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text },
        },
      ],
    }),
  })
}
