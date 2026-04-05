import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'
import { getProjectMentionText, sendSlackBotMessage, type SlackBlock } from '@/lib/integrations/slack'

// Slack署名検証
async function verifySlackSignature(request: NextRequest, rawBody: string): Promise<boolean> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) {
    console.error('SLACK_SIGNING_SECRET is not set')
    return false
  }

  const timestamp = request.headers.get('x-slack-request-timestamp')
  const signature = request.headers.get('x-slack-signature')

  if (!timestamp || !signature) return false

  // リプレイ攻撃防止: 5分以上前のリクエストは拒否
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false

  const baseString = `v0:${timestamp}:${rawBody}`
  const hmac = createHmac('sha256', signingSecret)
  const computed = `v0=${hmac.update(baseString).digest('hex')}`

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(computed))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Slack署名を検証するためにrawBodyを取得
    const rawBody = await request.text()
    const isValid = await verifySlackSignature(request, rawBody)
    if (!isValid) {
      console.error('Slack signature verification failed')
      return new Response('Unauthorized', { status: 401 })
    }

    // form-urlencoded をパース
    const params = new URLSearchParams(rawBody)
    const payloadStr = params.get('payload')
    if (!payloadStr) {
      return NextResponse.json({ error: 'No payload' }, { status: 400 })
    }

    const payload = JSON.parse(payloadStr)

    // Handle block_actions → open modal for comment input
    if (payload.type === 'block_actions') {
      const action = payload.actions?.[0]
      if (!action) return new Response('', { status: 200 })

      const actionId = action.action_id
      const entityId = action.value // the report/shift ID

      // 日報の承認/差戻し
      if (['report_approve', 'report_reject'].includes(actionId)) {
        return openCommentModal(payload, actionId, entityId, 'report')
      }

      // シフトの承認/差戻し
      if (['shift_approve', 'shift_reject'].includes(actionId)) {
        return openCommentModal(payload, actionId, entityId, 'shift')
      }

      return new Response('', { status: 200 })
    }

    // Handle view_submission → process the approval/rejection with comment
    if (payload.type === 'view_submission') {
      const callbackId = payload.view?.callback_id

      // 日報の承認/差戻し
      if (['report_approve_modal', 'report_reject_modal'].includes(callbackId)) {
        return handleReportApproval(payload)
      }

      // シフトの承認/差戻し
      if (['shift_approve_modal', 'shift_reject_modal'].includes(callbackId)) {
        return handleShiftApproval(payload)
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

// ---- コメントモーダルを開く共通関数 ----
async function openCommentModal(
  payload: Record<string, unknown>,
  actionId: string,
  entityId: string,
  entityType: 'report' | 'shift'
) {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) return new Response('', { status: 200 })

  const isApprove = actionId.includes('approve')
  const entityLabel = entityType === 'report' ? '日報' : 'シフト'
  const modalTitle = isApprove ? `${entityLabel}を承認` : `${entityLabel}を差戻し`
  const submitText = isApprove ? '承認する' : '差戻しする'

  const callbackPrefix = entityType === 'report' ? 'report' : 'shift'
  const callbackId = isApprove ? `${callbackPrefix}_approve_modal` : `${callbackPrefix}_reject_modal`

  const message = payload.message as Record<string, unknown> | undefined
  const channel = payload.channel as Record<string, string> | undefined

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
        callback_id: callbackId,
        private_metadata: JSON.stringify({
          entityId: entityId,
          channelId: channel?.id,
          messageTs: message?.ts,
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

// ---- Supabaseクライアント生成 ----
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, supabaseServiceKey)
}

// ---- Slackユーザーの権限チェック ----
async function checkSlackUserPermission(slackUserId: string): Promise<{ approverUserId: string | null; isAuthorized: boolean }> {
  const supabase = getSupabase()

  // Find the staff record for the Slack user
  const { data: approverStaff } = await supabase
    .from('staff')
    .select('user_id')
    .or(`custom_fields->slack_user_id.eq.${slackUserId},custom_fields->>slack_user_id.eq.${slackUserId}`)
    .limit(1)
    .single()

  if (!approverStaff?.user_id) {
    return { approverUserId: null, isAuthorized: false }
  }

  const approverUserId = approverStaff.user_id

  // Check admin/owner role
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role:roles(name)')
    .eq('user_id', approverUserId)

  const roleNames = (userRoles as { role: { name: string } | null }[] | null)
    ?.map((ur) => ur.role?.name)
    .filter(Boolean) || []

  const isAuthorized = roleNames.includes('admin') || roleNames.includes('owner')
  return { approverUserId, isAuthorized }
}

// ---- 日報の承認/差戻し処理 ----
async function handleReportApproval(payload: Record<string, unknown>) {
  const view = payload.view as Record<string, unknown>
  const callbackId = view?.callback_id as string
  const isApprove = callbackId === 'report_approve_modal'
  const metadata = JSON.parse((view?.private_metadata as string) || '{}')
  const { entityId: reportId, channelId, messageTs } = metadata
  const state = view?.state as Record<string, Record<string, Record<string, Record<string, unknown>>>>
  const comment = state?.values?.comment_block?.comment_input?.value as string || ''
  const user = payload.user as Record<string, string>
  const slackUserId = user?.id

  const supabase = getSupabase()

  // Fetch the report
  const { data: report, error: fetchError } = await supabase
    .from('work_reports')
    .select('id, status, report_type, report_date, staff_id, project_id, staff:staff_id(last_name, first_name), project:project_id(name)')
    .eq('id', reportId)
    .single()

  if (fetchError || !report) {
    await updateSlackMessageDirect(channelId, messageTs, '❌ 日報が見つかりません')
    return new Response('', { status: 200 })
  }

  // Check if already processed
  if (report.status === 'approved' || report.status === 'rejected') {
    const statusLabel = report.status === 'approved' ? '承認済み' : '差戻し済み'
    await updateSlackMessageDirect(channelId, messageTs, `⚠️ この日報は既に${statusLabel}です`)
    return new Response('', { status: 200 })
  }

  // Permission check
  const { approverUserId, isAuthorized } = await checkSlackUserPermission(slackUserId)
  if (!approverUserId || !isAuthorized) {
    await updateSlackMessageDirect(channelId, messageTs, '❌ 管理者権限が必要です')
    return new Response('', { status: 200 })
  }

  const newStatus = isApprove ? 'approved' : 'rejected'

  // Update the report
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
    approval_comment: comment || null,
  }
  if (newStatus === 'approved') {
    updateData.approved_at = new Date().toISOString()
    updateData.approved_by = approverUserId
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
    const messageBlocks: Record<string, unknown>[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *${staffName}* の *${typeLabel}* が *${actionLabel}* されました\n📅 ${report.report_date} | 🏢 ${projectName}`,
        },
      },
    ]

    if (comment) {
      messageBlocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `💬 コメント: ${comment}` },
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

      // メンションテキストを生成
      const mentionText = await getProjectMentionText(report.project_id, report.staff_id)

      const threadBlocks: SlackBlock[] = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *${actionLabel}* by <@${slackUserId}>\n🕐 ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
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

      await sendSlackBotMessage(channelId, {
        text: `${emoji} ${actionLabel}されました`,
        blocks: threadBlocks,
      }, { thread_ts: threadTs })
    }
  }

  return new Response('', { status: 200 })
}

// ---- シフトの承認/差戻し処理 ----
async function handleShiftApproval(payload: Record<string, unknown>) {
  const view = payload.view as Record<string, unknown>
  const callbackId = view?.callback_id as string
  const isApprove = callbackId === 'shift_approve_modal'
  const metadata = JSON.parse((view?.private_metadata as string) || '{}')
  const { entityId: shiftId, channelId, messageTs } = metadata
  const state = view?.state as Record<string, Record<string, Record<string, Record<string, unknown>>>>
  const comment = state?.values?.comment_block?.comment_input?.value as string || ''
  const user = payload.user as Record<string, string>
  const slackUserId = user?.id

  const supabase = getSupabase()

  // Fetch the shift
  const { data: shift, error: fetchError } = await supabase
    .from('shifts')
    .select('id, status, staff_id, project_id, shift_date, start_time, end_time, shift_type, slack_thread_ts, staff:staff_id(last_name, first_name), project:project_id(name)')
    .eq('id', shiftId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !shift) {
    await updateSlackMessageDirect(channelId, messageTs, '❌ シフトが見つかりません')
    return new Response('', { status: 200 })
  }

  // Check if already processed
  if (shift.status === 'APPROVED' || shift.status === 'REJECTED') {
    const statusLabel = shift.status === 'APPROVED' ? '承認済み' : '差戻し済み'
    await updateSlackMessageDirect(channelId, messageTs, `⚠️ このシフトは既に${statusLabel}です`)
    return new Response('', { status: 200 })
  }

  // Permission check
  const { approverUserId, isAuthorized } = await checkSlackUserPermission(slackUserId)
  if (!approverUserId || !isAuthorized) {
    await updateSlackMessageDirect(channelId, messageTs, '❌ 管理者権限が必要です')
    return new Response('', { status: 200 })
  }

  const newStatus = isApprove ? 'APPROVED' : 'REJECTED'
  const now = new Date().toISOString()

  // Update the shift
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: now,
    approval_comment: comment || null,
  }
  if (newStatus === 'APPROVED') {
    updateData.approved_at = now
    updateData.approved_by = approverUserId
  }

  const { error: updateError } = await supabase
    .from('shifts')
    .update(updateData)
    .eq('id', shiftId)

  if (updateError) {
    await updateSlackMessageDirect(channelId, messageTs, `❌ 更新に失敗しました: ${updateError.message}`)
    return new Response('', { status: 200 })
  }

  // Record in approval history
  await supabase.from('shift_approval_history').insert({
    shift_id: shiftId,
    action: isApprove ? 'APPROVE' : 'REJECT',
    comment: comment || null,
    performed_by: approverUserId,
  })

  // Build updated message
  const staffName = (() => {
    const s = shift.staff as { last_name?: string; first_name?: string } | null
    return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : ''
  })()
  const projectName = (shift.project as { name?: string } | null)?.name || ''

  const emoji = newStatus === 'APPROVED' ? '✅' : '🔙'
  const actionLabel = newStatus === 'APPROVED' ? '承認' : '差戻し'

  const botToken = process.env.SLACK_BOT_TOKEN
  if (botToken) {
    // Update the original Slack message (remove buttons, show result)
    const messageBlocks: Record<string, unknown>[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *${staffName}* のシフトが *${actionLabel}* されました\n📆 ${shift.shift_date} | ⏰ ${shift.start_time}〜${shift.end_time} | 🏢 ${projectName}`,
        },
      },
    ]

    if (comment) {
      messageBlocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `💬 コメント: ${comment}` },
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
        text: `${emoji} ${staffName} のシフトが${actionLabel}されました（${projectName}）`,
        blocks: messageBlocks,
      }),
    })
    const updateResult = await res.json()
    if (!updateResult.ok) {
      console.error('chat.update failed:', updateResult.error)
    }

    // スレッドにリプライ
    const threadTs = (shift.slack_thread_ts as string) || messageTs

    if (threadTs && channelId) {
      // slack_thread_ts が未保存の場合は保存
      if (!shift.slack_thread_ts && messageTs) {
        await supabase
          .from('shifts')
          .update({ slack_thread_ts: messageTs })
          .eq('id', shiftId)
      }

      // メンションテキストを生成
      const mentionText = await getProjectMentionText(shift.project_id, shift.staff_id)

      const threadBlocks: SlackBlock[] = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *${actionLabel}* by <@${slackUserId}>\n🕐 ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
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

      await sendSlackBotMessage(channelId, {
        text: `${emoji} ${actionLabel}されました`,
        blocks: threadBlocks,
      }, { thread_ts: threadTs })
    }

    // APPROVED の場合、Google Calendar同期（fire-and-forget）
    if (newStatus === 'APPROVED') {
      try {
        const { syncShiftToCalendar } = await import('@/lib/integrations/google-calendar-sync')
        await syncShiftToCalendar(shiftId)
      } catch (e) {
        console.error('Calendar sync on Slack approve failed:', e)
      }
    }
  }

  return new Response('', { status: 200 })
}

// Helper to update a Slack message using channel/ts directly
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
