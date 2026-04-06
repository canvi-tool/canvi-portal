import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'
import { getProjectMentionText, sendSlackBotMessage, type SlackBlock } from '@/lib/integrations/slack'

// Slack署名検証
async function verifySlackSignature(request: NextRequest, rawBody: string): Promise<boolean> {
  // 環境変数の前後空白/改行を除去（Vercel貼り付けミス対策）
  const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim()
  if (!signingSecret) {
    console.error('[slack/interactions] SLACK_SIGNING_SECRET is not set')
    return false
  }
  // 開発/緊急用バイパス: SLACK_SKIP_SIGNATURE_VERIFICATION=true で署名検証を一時スキップ
  if (process.env.SLACK_SKIP_SIGNATURE_VERIFICATION === 'true') {
    console.warn('[slack/interactions] signature verification SKIPPED via env flag')
    return true
  }

  const timestamp = request.headers.get('x-slack-request-timestamp')
  const signature = request.headers.get('x-slack-signature')

  if (!timestamp || !signature) {
    console.error('[slack/interactions] missing headers', { hasTs: !!timestamp, hasSig: !!signature })
    return false
  }

  // リプレイ攻撃防止: 5分以上前のリクエストは拒否
  const now = Math.floor(Date.now() / 1000)
  const drift = Math.abs(now - parseInt(timestamp, 10))
  if (drift > 300) {
    console.error('[slack/interactions] timestamp drift too large', { drift })
    return false
  }

  const baseString = `v0:${timestamp}:${rawBody}`
  const hmac = createHmac('sha256', signingSecret)
  const computed = `v0=${hmac.update(baseString).digest('hex')}`

  try {
    const sigBuf = Buffer.from(signature)
    const cmpBuf = Buffer.from(computed)
    if (sigBuf.length !== cmpBuf.length) {
      console.error('[slack/interactions] signature length mismatch', {
        got: sigBuf.length,
        expected: cmpBuf.length,
        secretPrefix: signingSecret.slice(0, 4),
        sigPrefix: signature.slice(0, 10),
        computedPrefix: computed.slice(0, 10),
      })
      return false
    }
    const ok = timingSafeEqual(sigBuf, cmpBuf)
    if (!ok) {
      console.error('[slack/interactions] signature mismatch', {
        secretPrefix: signingSecret.slice(0, 4),
        sigPrefix: signature.slice(0, 10),
        computedPrefix: computed.slice(0, 10),
      })
    }
    return ok
  } catch (e) {
    console.error('[slack/interactions] signature verify exception', e)
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

      // 打刻修正の承認/差戻し（管理者）
      if (['correction_approve', 'correction_reject'].includes(actionId)) {
        return openCommentModal(payload, actionId, entityId, 'correction')
      }

      // 打刻修正の再申請（本人のみ）
      if (actionId === 'correction_resubmit') {
        return openCorrectionSubmitModal(payload, entityId)
      }

      // シフト乖離: 定時で丸める（管理者）
      if (actionId === 'diff_round') {
        return handleDiffRound(payload)
      }

      // シフト乖離: 修正依頼する（管理者）
      if (actionId === 'diff_request_fix') {
        return handleDiffRequestFix(payload)
      }

      // シフト乖離: 打刻修正を入力する（本人のみ）
      if (actionId === 'diff_member_fix') {
        return openDiffMemberFixModal(payload)
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

      // 打刻修正 承認/差戻し
      if (['correction_approve_modal', 'correction_reject_modal'].includes(callbackId)) {
        return handleCorrectionApproval(payload)
      }

      // 打刻修正 申請（本人による送信）
      if (callbackId === 'correction_submit_modal') {
        return handleCorrectionSubmit(payload)
      }

      // シフト乖離: 本人による打刻修正モーダル送信
      if (callbackId === 'diff_member_fix_modal') {
        return handleDiffMemberFixSubmit(payload)
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
  entityType: 'report' | 'shift' | 'correction'
) {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) return new Response('', { status: 200 })

  const isApprove = actionId.includes('approve')
  const entityLabel =
    entityType === 'report' ? '日報' : entityType === 'shift' ? 'シフト' : '打刻修正'
  const modalTitle = isApprove ? `${entityLabel}を承認` : `${entityLabel}を差戻し`
  const submitText = isApprove ? '承認する' : '差戻しする'

  const callbackPrefix = entityType
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
            label: { type: 'plain_text', text: 'コメント' },
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
    await updateSlackMessageDirect(channelId, messageTs, '日報が見つかりません')
    return new Response('', { status: 200 })
  }

  // Check if already processed
  if (report.status === 'approved' || report.status === 'rejected') {
    const statusLabel = report.status === 'approved' ? '承認済み' : '差戻し済み'
    await updateSlackMessageDirect(channelId, messageTs, `この日報は既に${statusLabel}です`)
    return new Response('', { status: 200 })
  }

  // Permission check
  const { approverUserId, isAuthorized } = await checkSlackUserPermission(slackUserId)
  if (!approverUserId || !isAuthorized) {
    await updateSlackMessageDirect(channelId, messageTs, '管理者権限が必要です')
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
    await updateSlackMessageDirect(channelId, messageTs, `更新に失敗しました: ${updateError.message}`)
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

  const actionLabel = newStatus === 'approved' ? '承認' : '差戻し'

  // Update the original Slack message (remove buttons, show result)
  const botToken = process.env.SLACK_BOT_TOKEN
  if (botToken) {
    const messageBlocks: Record<string, unknown>[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${staffName}* の *${typeLabel}* が *${actionLabel}* されました\n${report.report_date} | ${projectName}`,
        },
      },
    ]

    if (comment) {
      messageBlocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `コメント: ${comment}` },
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
        text: `${staffName} の ${typeLabel} が${actionLabel}されました（${projectName}）`,
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
            text: `*${actionLabel}* by <@${slackUserId}>\n${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
          },
        },
      ]

      if (comment) {
        threadBlocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `コメント: ${comment}` },
        })
      }

      if (mentionText) {
        threadBlocks.push({
          type: 'context',
          elements: [{ type: 'mrkdwn', text: mentionText }],
        })
      }

      await sendSlackBotMessage(channelId, {
        text: `${actionLabel}されました`,
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
    await updateSlackMessageDirect(channelId, messageTs, 'シフトが見つかりません')
    return new Response('', { status: 200 })
  }

  // Check if already processed
  if (shift.status === 'APPROVED' || shift.status === 'NEEDS_REVISION') {
    const statusLabel = shift.status === 'APPROVED' ? '承認済み' : '差戻し済み'
    await updateSlackMessageDirect(channelId, messageTs, `このシフトは既に${statusLabel}です`)
    return new Response('', { status: 200 })
  }

  // Permission check
  const { approverUserId, isAuthorized } = await checkSlackUserPermission(slackUserId)
  if (!approverUserId || !isAuthorized) {
    await updateSlackMessageDirect(channelId, messageTs, '管理者権限が必要です')
    return new Response('', { status: 200 })
  }

  const newStatus = isApprove ? 'APPROVED' : 'NEEDS_REVISION'
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
    await updateSlackMessageDirect(channelId, messageTs, `更新に失敗しました: ${updateError.message}`)
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

  const actionLabel = newStatus === 'APPROVED' ? '承認' : '差戻し'

  const botToken = process.env.SLACK_BOT_TOKEN
  if (botToken) {
    // Update the original Slack message (remove buttons, show result)
    const messageBlocks: Record<string, unknown>[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${staffName}* のシフトが *${actionLabel}* されました\n${shift.shift_date} | ${shift.start_time}〜${shift.end_time} | ${projectName}`,
        },
      },
    ]

    if (comment) {
      messageBlocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `コメント: ${comment}` },
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
        text: `${staffName} のシフトが${actionLabel}されました（${projectName}）`,
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
            text: `*${actionLabel}* by <@${slackUserId}>\n${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
          },
        },
      ]

      if (comment) {
        threadBlocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `コメント: ${comment}` },
        })
      }

      if (mentionText) {
        threadBlocks.push({
          type: 'context',
          elements: [{ type: 'mrkdwn', text: mentionText }],
        })
      }

      await sendSlackBotMessage(channelId, {
        text: `${actionLabel}されました`,
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

// ---- Slackユーザー→staff/user_id解決（権限不問） ----
async function resolveSlackUser(
  slackUserId: string
): Promise<{ userId: string | null; staffId: string | null; displayName: string | null }> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('staff')
    .select('id, user_id, last_name, first_name')
    .or(`custom_fields->slack_user_id.eq.${slackUserId},custom_fields->>slack_user_id.eq.${slackUserId}`)
    .limit(1)
    .single()
  if (!data) return { userId: null, staffId: null, displayName: null }
  return {
    userId: (data as { user_id: string | null }).user_id || null,
    staffId: (data as { id: string }).id,
    displayName: `${(data as { last_name?: string }).last_name || ''} ${(data as { first_name?: string }).first_name || ''}`.trim(),
  }
}

// ---- Slack DM送信（users.emailまたはcustom_fields経由） ----
async function sendSlackDM(slackUserId: string, text: string, blocks?: unknown[]) {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken || !slackUserId) return
  // まずconversations.openでDMチャンネルID取得
  const openRes = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ users: slackUserId }),
  })
  const openJson = await openRes.json()
  const channelId = openJson?.channel?.id
  if (!channelId) return
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: channelId, text, blocks }),
  })
}

// ---- 打刻修正の承認/差戻し処理 ----
async function handleCorrectionApproval(payload: Record<string, unknown>) {
  const view = payload.view as Record<string, unknown>
  const callbackId = view?.callback_id as string
  const isApprove = callbackId === 'correction_approve_modal'
  const metadata = JSON.parse((view?.private_metadata as string) || '{}')
  const { entityId: correctionId, channelId, messageTs } = metadata
  const state = view?.state as Record<string, Record<string, Record<string, Record<string, unknown>>>>
  const comment = (state?.values?.comment_block?.comment_input?.value as string) || ''
  const user = payload.user as Record<string, string>
  const slackUserId = user?.id

  if (!isApprove && !comment.trim()) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { comment_block: '差戻しにはコメントが必要です' },
    })
  }

  const supabase = getSupabase()

  // 申請取得
  const { data: req } = await supabase
    .from('attendance_correction_requests')
    .select('*, project:project_id(id, name, slack_channel_id)')
    .eq('id', correctionId)
    .single()

  if (!req) {
    await updateSlackMessageDirect(channelId, messageTs, '申請が見つかりません')
    return new Response('', { status: 200 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = req as any
  if (r.status !== 'pending') {
    await updateSlackMessageDirect(channelId, messageTs, `この申請は既に処理済みです（${r.status}）`)
    return new Response('', { status: 200 })
  }

  // 権限: PJの管理者以上
  const { approverUserId, isAuthorized } = await checkSlackUserPermission(slackUserId)
  if (!approverUserId || !isAuthorized) {
    await updateSlackMessageDirect(channelId, messageTs, '管理者権限が必要です')
    return new Response('', { status: 200 })
  }
  // PJアサイン確認
  if (r.project_id) {
    const { data: assigned } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', r.project_id)
      .eq('user_id', approverUserId)
      .limit(1)
      .maybeSingle()
    // owner は全PJ許可
    const { data: ownerCheck } = await supabase
      .from('user_roles')
      .select('role:roles(name)')
      .eq('user_id', approverUserId)
    const isOwnerRole = (ownerCheck as { role: { name: string } | null }[] | null)?.some(
      (ur) => ur.role?.name === 'owner'
    )
    if (!isOwnerRole && !assigned) {
      await updateSlackMessageDirect(channelId, messageTs, 'このPJの管理権限がありません')
      return new Response('', { status: 200 })
    }
  }

  const newStatus = isApprove ? 'approved' : 'rejected'
  const now = new Date().toISOString()

  // 承認 → 元レコード更新
  if (isApprove && r.attendance_record_id) {
    const update: Record<string, unknown> = {
      clock_in: r.requested_clock_in,
      clock_out: r.requested_clock_out,
      break_minutes: r.requested_break_minutes,
      note: r.requested_note,
      status: 'modified',
      modified_by: approverUserId,
      modification_reason: r.reason,
    }
    if (r.requested_clock_in && r.requested_clock_out) {
      const ms =
        new Date(r.requested_clock_out).getTime() - new Date(r.requested_clock_in).getTime()
      update.work_minutes = Math.max(
        0,
        Math.floor(ms / 60000) - (r.requested_break_minutes || 0)
      )
    }
    await supabase.from('attendance_records').update(update).eq('id', r.attendance_record_id)
  }

  await supabase
    .from('attendance_correction_requests')
    .update({
      status: newStatus,
      reviewed_by_user_id: approverUserId,
      reviewed_at: now,
      review_comment: comment || null,
    })
    .eq('id', correctionId)

  const actionLabel = isApprove ? '承認' : '差戻し'
  const projectName = (r.project as { name?: string } | null)?.name || ''

  // 元メッセージ更新（ボタン除去）
  const botToken = process.env.SLACK_BOT_TOKEN
  if (botToken && channelId && messageTs) {
    const messageBlocks: Record<string, unknown>[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*打刻修正* が *${actionLabel}* されました${projectName ? `（${projectName}）` : ''}`,
        },
      },
    ]
    if (comment) {
      messageBlocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `コメント: ${comment}` },
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
    await fetch('https://slack.com/api/chat.update', {
      method: 'POST',
      headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: channelId,
        ts: messageTs,
        text: `打刻修正が${actionLabel}されました`,
        blocks: messageBlocks,
      }),
    })

    // スレッドリプライ
    const threadTs = r.slack_thread_ts || messageTs
    const threadBlocks: SlackBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${actionLabel}* by <@${slackUserId}>${comment ? `\nコメント: ${comment}` : ''}`,
        },
      },
    ]
    // 差戻しの場合は再申請ボタン付与
    if (!isApprove && r.attendance_record_id) {
      threadBlocks.push({
        type: 'actions',
        block_id: 'correction_resubmit_actions',
        elements: [
          {
            type: 'button',
            style: 'primary',
            text: { type: 'plain_text', text: '再申請する' },
            action_id: 'correction_resubmit',
            value: r.attendance_record_id,
          },
        ],
      } as unknown as SlackBlock)
    }
    await sendSlackBotMessage(
      channelId,
      { text: `打刻修正が${actionLabel}されました`, blocks: threadBlocks },
      { thread_ts: threadTs }
    )
  }

  // 申請者へDM
  try {
    const { data: requesterStaff } = await supabase
      .from('staff')
      .select('custom_fields')
      .eq('user_id', r.requested_by_user_id)
      .limit(1)
      .maybeSingle()
    const requesterSlackId = ((requesterStaff as { custom_fields?: Record<string, string> } | null)
      ?.custom_fields as Record<string, string> | undefined)?.slack_user_id
    if (requesterSlackId) {
      const dmText = isApprove
        ? `:white_check_mark: 打刻修正申請が承認されました${projectName ? `（${projectName}）` : ''}`
        : `:no_entry: 打刻修正申請が差戻されました${projectName ? `（${projectName}）` : ''}\n理由: ${comment}`
      const dmBlocks: unknown[] = [
        { type: 'section', text: { type: 'mrkdwn', text: dmText } },
      ]
      if (!isApprove && r.attendance_record_id) {
        dmBlocks.push({
          type: 'actions',
          elements: [
            {
              type: 'button',
              style: 'primary',
              text: { type: 'plain_text', text: '再申請する' },
              action_id: 'correction_resubmit',
              value: r.attendance_record_id,
            },
          ],
        })
      }
      await sendSlackDM(requesterSlackId, dmText, dmBlocks)
    }
  } catch (e) {
    console.error('correction DM error:', e)
  }

  return new Response('', { status: 200 })
}

// ---- 打刻修正 申請モーダルを開く（本人のみ） ----
async function openCorrectionSubmitModal(
  payload: Record<string, unknown>,
  attendanceRecordId: string
) {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) return new Response('', { status: 200 })

  const user = payload.user as Record<string, string>
  const slackUserId = user?.id

  // 本人確認: slack_user_id → user_id → 該当レコードのuser_idと一致必須
  const { userId } = await resolveSlackUser(slackUserId)
  const supabase = getSupabase()
  const { data: rec } = await supabase
    .from('attendance_records')
    .select('id, user_id, date, clock_in, clock_out, break_minutes, note')
    .eq('id', attendanceRecordId)
    .is('deleted_at', null)
    .single()

  if (!rec || !userId || (rec as { user_id: string }).user_id !== userId) {
    // ephemeralでエラー表示（簡易: チャンネルに返信不可なので無視）
    await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trigger_id: payload.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'correction_submit_error',
          title: { type: 'plain_text', text: 'エラー' },
          close: { type: 'plain_text', text: '閉じる' },
          blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: ':warning: ご自身の打刻のみ修正申請できます' },
            },
          ],
        },
      }),
    })
    return new Response('', { status: 200 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = rec as any
  // ISO→Slack datetimepicker用値（YYYY-MM-DD / HH:mm）
  const toDate = (s: string | null) => {
    if (!s) return ''
    const d = new Date(s)
    return d.toISOString().slice(0, 10)
  }
  const toTime = (s: string | null) => {
    if (!s) return ''
    const d = new Date(s)
    const jst = new Date(d.getTime() + 9 * 3600 * 1000)
    return jst.toISOString().slice(11, 16)
  }

  await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trigger_id: payload.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'correction_submit_modal',
        private_metadata: JSON.stringify({ attendanceRecordId, date: r.date }),
        title: { type: 'plain_text', text: '打刻修正申請' },
        submit: { type: 'plain_text', text: '送信' },
        close: { type: 'plain_text', text: 'キャンセル' },
        blocks: [
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `対象日: *${r.date}*` }],
          },
          {
            type: 'input',
            block_id: 'clock_in_date',
            element: {
              type: 'datepicker',
              action_id: 'v',
              initial_date: toDate(r.clock_in) || r.date,
            },
            label: { type: 'plain_text', text: '出勤 日付' },
          },
          {
            type: 'input',
            block_id: 'clock_in_time',
            element: {
              type: 'timepicker',
              action_id: 'v',
              initial_time: toTime(r.clock_in) || '09:00',
            },
            label: { type: 'plain_text', text: '出勤 時刻' },
          },
          {
            type: 'input',
            block_id: 'clock_out_date',
            optional: true,
            element: {
              type: 'datepicker',
              action_id: 'v',
              initial_date: toDate(r.clock_out) || r.date,
            },
            label: { type: 'plain_text', text: '退勤 日付' },
          },
          {
            type: 'input',
            block_id: 'clock_out_time',
            optional: true,
            element: {
              type: 'timepicker',
              action_id: 'v',
              initial_time: toTime(r.clock_out) || '18:00',
            },
            label: { type: 'plain_text', text: '退勤 時刻' },
          },
          {
            type: 'input',
            block_id: 'break_minutes',
            element: {
              type: 'plain_text_input',
              action_id: 'v',
              initial_value: String(r.break_minutes ?? 0),
            },
            label: { type: 'plain_text', text: '休憩（分）' },
          },
          {
            type: 'input',
            block_id: 'reason',
            element: {
              type: 'plain_text_input',
              action_id: 'v',
              multiline: true,
              placeholder: { type: 'plain_text', text: '修正理由を入力してください' },
            },
            label: { type: 'plain_text', text: '修正理由' },
          },
        ],
      },
    }),
  })

  return new Response('', { status: 200 })
}

// ---- 打刻修正 申請送信処理（本人のみ） ----
async function handleCorrectionSubmit(payload: Record<string, unknown>) {
  const view = payload.view as Record<string, unknown>
  const metadata = JSON.parse((view?.private_metadata as string) || '{}')
  const { attendanceRecordId } = metadata
  const user = payload.user as Record<string, string>
  const slackUserId = user?.id

  const state = view?.state as Record<string, Record<string, Record<string, Record<string, unknown>>>>
  const v = state?.values || {}
  const getVal = (block: string, key = 'v', field = 'value') =>
    (v[block]?.[key]?.[field] as string) || ''
  const getDate = (block: string) => (v[block]?.v?.selected_date as string) || ''
  const getTime = (block: string) => (v[block]?.v?.selected_time as string) || ''

  const inDate = getDate('clock_in_date')
  const inTime = getTime('clock_in_time')
  const outDate = getDate('clock_out_date')
  const outTime = getTime('clock_out_time')
  const breakMinStr = getVal('break_minutes')
  const reason = getVal('reason')

  if (!reason.trim()) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { reason: '修正理由は必須です' },
    })
  }

  const toIso = (date: string, time: string): string | null => {
    if (!date || !time) return null
    // JSTとして解釈してUTCに変換
    const d = new Date(`${date}T${time}:00+09:00`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  const requestedClockIn = toIso(inDate, inTime)
  const requestedClockOut = outDate && outTime ? toIso(outDate, outTime) : null
  const breakMinutes = parseInt(breakMinStr, 10)

  // 本人確認
  const { userId, displayName } = await resolveSlackUser(slackUserId)
  if (!userId) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { reason: 'ユーザー情報が見つかりません' },
    })
  }

  const supabase = getSupabase()
  const { data: rec } = await supabase
    .from('attendance_records')
    .select('*, project:project_id(id, name, slack_channel_id)')
    .eq('id', attendanceRecordId)
    .is('deleted_at', null)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = rec as any
  if (!r || r.user_id !== userId) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { reason: 'ご自身の打刻のみ申請できます' },
    })
  }

  const { data: created } = await supabase
    .from('attendance_correction_requests')
    .insert({
      attendance_record_id: r.id,
      requested_by_user_id: userId,
      project_id: r.project_id,
      original_clock_in: r.clock_in,
      original_clock_out: r.clock_out,
      original_break_minutes: r.break_minutes,
      original_note: r.note,
      requested_clock_in: requestedClockIn ?? r.clock_in,
      requested_clock_out: requestedClockOut ?? r.clock_out,
      requested_break_minutes: isNaN(breakMinutes) ? r.break_minutes : breakMinutes,
      requested_note: r.note,
      reason,
      status: 'pending',
    })
    .select()
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = created as any
  if (!c) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { reason: '申請の作成に失敗しました' },
    })
  }

  // PJチャンネルへ通知（承認/差戻しボタン付き）
  try {
    const proj = r.project as { name?: string; slack_channel_id?: string } | null
    const fmt = (s: string | null) =>
      s
        ? new Date(s).toLocaleString('ja-JP', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Tokyo',
          })
        : '-'
    const text = `:memo: 打刻修正申請（Slackより）\n*${displayName || 'メンバー'}* さんから打刻修正の申請${proj?.name ? `（${proj.name}）` : ''}\n• 出勤: ${fmt(r.clock_in)} → ${fmt(requestedClockIn ?? r.clock_in)}\n• 退勤: ${fmt(r.clock_out)} → ${fmt(requestedClockOut ?? r.clock_out)}\n• 休憩: ${r.break_minutes ?? 0}分 → ${isNaN(breakMinutes) ? r.break_minutes ?? 0 : breakMinutes}分\n• 理由: ${reason}`
    const blocks: SlackBlock[] = [
      { type: 'section', text: { type: 'mrkdwn', text } },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            style: 'primary',
            text: { type: 'plain_text', text: '承認' },
            action_id: 'correction_approve',
            value: c.id,
          },
          {
            type: 'button',
            style: 'danger',
            text: { type: 'plain_text', text: '差戻し' },
            action_id: 'correction_reject',
            value: c.id,
          },
        ],
      } as unknown as SlackBlock,
    ]
    const { sendProjectNotification } = await import('@/lib/integrations/slack')
    const result = await sendProjectNotification(
      { text, blocks },
      proj?.slack_channel_id || null,
      { projectId: r.project_id, staffId: r.staff_id }
    )
    if (result.ts) {
      await supabase
        .from('attendance_correction_requests')
        .update({ slack_thread_ts: result.ts })
        .eq('id', c.id)
    }
  } catch (e) {
    console.error('correction submit notify error:', e)
  }

  return new Response('', { status: 200 })
}

// =============================================================
// シフト乖離フロー (cron/shift-attendance-diff から開始)
// =============================================================

// 共通: 乖離アクションのPJアサイン確認 (correctionと同じ)
async function checkDiffPjPermission(
  approverUserId: string,
  projectId: string | null
): Promise<boolean> {
  if (!projectId) return true
  const supabase = getSupabase()
  const { data: ownerCheck } = await supabase
    .from('user_roles')
    .select('role:roles(name)')
    .eq('user_id', approverUserId)
  const isOwnerRole = (ownerCheck as { role: { name: string } | null }[] | null)?.some(
    (ur) => ur.role?.name === 'owner'
  )
  if (isOwnerRole) return true
  const { data: assigned } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', approverUserId)
    .limit(1)
    .maybeSingle()
  return !!assigned
}

// ボタンvalueデコード: `${attendanceRecordId}|${shiftId||''}|${staffSlackUserId||''}`
function parseDiffValue(value: string): {
  attendanceRecordId: string
  shiftId: string | null
  staffSlackUserId: string | null
} {
  const [attendanceRecordId, shiftId, staffSlackUserId] = (value || '').split('|')
  return {
    attendanceRecordId: attendanceRecordId || '',
    shiftId: shiftId || null,
    staffSlackUserId: staffSlackUserId || null,
  }
}

function jstHHmm(iso: string): string {
  const d = new Date(iso)
  const jst = new Date(d.getTime() + 9 * 3600 * 1000)
  return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`
}

// ---- 「定時で丸める」 ----
async function handleDiffRound(payload: Record<string, unknown>) {
  const action = (payload.actions as Array<Record<string, string>>)[0]
  const value = action?.value || ''
  const { attendanceRecordId, shiftId } = parseDiffValue(value)
  const user = payload.user as Record<string, string>
  const slackUserId = user?.id
  const channel = payload.channel as Record<string, string> | undefined
  const message = payload.message as Record<string, unknown> | undefined
  const channelId = channel?.id
  const messageTs = (message?.ts as string) || ''

  if (!attendanceRecordId) return new Response('', { status: 200 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any

  // 権限
  const { approverUserId, isAuthorized } = await checkSlackUserPermission(slackUserId)
  if (!approverUserId || !isAuthorized) {
    await sendDiffEphemeral(channelId, slackUserId, ':warning: 管理者権限が必要です')
    return new Response('', { status: 200 })
  }

  // 対象レコード
  const { data: rec } = await supabase
    .from('attendance_records')
    .select('id, project_id, staff_id, user_id, break_minutes, slack_diff_thread_ts, slack_diff_channel_id, staff:staff_id(last_name, first_name)')
    .eq('id', attendanceRecordId)
    .is('deleted_at', null)
    .single()

  if (!rec) {
    await sendDiffEphemeral(channelId, slackUserId, '対象の打刻レコードが見つかりません')
    return new Response('', { status: 200 })
  }

  if (!(await checkDiffPjPermission(approverUserId, rec.project_id))) {
    await sendDiffEphemeral(channelId, slackUserId, ':warning: このPJの管理権限がありません')
    return new Response('', { status: 200 })
  }

  // シフト取得
  let shift: { shift_date: string; start_time: string; end_time: string } | null = null
  if (shiftId) {
    const { data: s } = await supabase
      .from('shifts')
      .select('shift_date, start_time, end_time')
      .eq('id', shiftId)
      .single()
    shift = (s as unknown as { shift_date: string; start_time: string; end_time: string } | null) || null
  }
  if (!shift || !shift.start_time || !shift.end_time || !shift.shift_date) {
    await sendDiffEphemeral(channelId, slackUserId, 'シフト情報が不完全なため丸め処理を実行できません')
    return new Response('', { status: 200 })
  }

  // JST → ISO
  const clockInIso = new Date(`${shift.shift_date}T${shift.start_time.slice(0, 5)}:00+09:00`).toISOString()
  const clockOutIso = new Date(`${shift.shift_date}T${shift.end_time.slice(0, 5)}:00+09:00`).toISOString()
  const totalMs = new Date(clockOutIso).getTime() - new Date(clockInIso).getTime()
  let workMinutes = Math.max(0, Math.floor(totalMs / 60000))
  let breakMinutes: number = rec.break_minutes ?? 0
  if (workMinutes >= 300) {
    breakMinutes = 60
  }
  workMinutes = Math.max(0, workMinutes - breakMinutes)

  const { error: upErr } = await supabase
    .from('attendance_records')
    .update({
      clock_in: clockInIso,
      clock_out: clockOutIso,
      break_minutes: breakMinutes,
      work_minutes: workMinutes,
      status: 'modified',
      modified_by: approverUserId,
      modification_reason: '定時丸め (Slack)',
    })
    .eq('id', attendanceRecordId)

  if (upErr) {
    await sendDiffEphemeral(channelId, slackUserId, `更新に失敗しました: ${upErr.message}`)
    return new Response('', { status: 200 })
  }

  // スレッド ts (cronで保存済 or 当該メッセージts)
  const threadTs = (rec.slack_diff_thread_ts as string) || messageTs
  const replyChannel = (rec.slack_diff_channel_id as string) || channelId

  const staffName = (() => {
    const s = rec.staff as { last_name?: string; first_name?: string } | null
    return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : 'メンバー'
  })()

  if (replyChannel && threadTs) {
    try {
      await sendSlackBotMessage(
        replyChannel,
        {
          text: `${staffName} を定時で丸めました`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:white_check_mark: *${staffName}* を定時で丸めました → 出勤 ${jstHHmm(clockInIso)} / 退勤 ${jstHHmm(clockOutIso)} / 休憩 ${breakMinutes}分 by <@${slackUserId}>`,
              },
            },
          ],
        },
        { thread_ts: threadTs }
      )
    } catch (e) {
      console.error('diff_round thread reply error:', e)
    }
  }

  return new Response('', { status: 200 })
}

// ---- 「修正依頼する」 ----
async function handleDiffRequestFix(payload: Record<string, unknown>) {
  const action = (payload.actions as Array<Record<string, string>>)[0]
  const value = action?.value || ''
  const { attendanceRecordId, staffSlackUserId } = parseDiffValue(value)
  const user = payload.user as Record<string, string>
  const slackUserId = user?.id
  const channel = payload.channel as Record<string, string> | undefined
  const message = payload.message as Record<string, unknown> | undefined
  const channelId = channel?.id
  const messageTs = (message?.ts as string) || ''

  if (!attendanceRecordId) return new Response('', { status: 200 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any

  const { approverUserId, isAuthorized } = await checkSlackUserPermission(slackUserId)
  if (!approverUserId || !isAuthorized) {
    await sendDiffEphemeral(channelId, slackUserId, ':warning: 管理者権限が必要です')
    return new Response('', { status: 200 })
  }

  const { data: rec } = await supabase
    .from('attendance_records')
    .select('id, project_id, staff_id, slack_diff_thread_ts, slack_diff_channel_id, staff:staff_id(last_name, first_name, custom_fields)')
    .eq('id', attendanceRecordId)
    .is('deleted_at', null)
    .single()

  if (!rec) {
    await sendDiffEphemeral(channelId, slackUserId, '対象の打刻レコードが見つかりません')
    return new Response('', { status: 200 })
  }

  if (!(await checkDiffPjPermission(approverUserId, rec.project_id))) {
    await sendDiffEphemeral(channelId, slackUserId, ':warning: このPJの管理権限がありません')
    return new Response('', { status: 200 })
  }

  const staffCf = rec.staff?.custom_fields as Record<string, string> | null | undefined
  const targetSlackUserId = staffSlackUserId || (staffCf?.slack_user_id as string | undefined) || null
  const staffName = `${rec.staff?.last_name || ''} ${rec.staff?.first_name || ''}`.trim() || 'メンバー'

  const threadTs = (rec.slack_diff_thread_ts as string) || messageTs
  const replyChannel = (rec.slack_diff_channel_id as string) || channelId

  const mention = targetSlackUserId ? `<@${targetSlackUserId}>` : `*${staffName}*`

  if (replyChannel && threadTs) {
    try {
      await sendSlackBotMessage(
        replyChannel,
        {
          text: `${staffName} に打刻修正のお願いです`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:pencil2: ${mention} 打刻修正の入力をお願いします (依頼者: <@${slackUserId}>)`,
              },
            },
            {
              type: 'actions',
              block_id: `diff_member_fix_actions_${attendanceRecordId}`,
              elements: [
                {
                  type: 'button',
                  style: 'primary',
                  text: { type: 'plain_text', text: '打刻修正を入力する' },
                  action_id: 'diff_member_fix',
                  value: attendanceRecordId,
                },
              ],
            } as unknown as SlackBlock,
          ],
        },
        { thread_ts: threadTs }
      )
    } catch (e) {
      console.error('diff_request_fix thread reply error:', e)
    }
  }

  return new Response('', { status: 200 })
}

// ---- 「打刻修正を入力する」 (本人のみ) → モーダルを開く ----
async function openDiffMemberFixModal(payload: Record<string, unknown>) {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) return new Response('', { status: 200 })

  const action = (payload.actions as Array<Record<string, string>>)[0]
  const attendanceRecordId = action?.value || ''
  const user = payload.user as Record<string, string>
  const slackUserId = user?.id
  const channel = payload.channel as Record<string, string> | undefined
  const message = payload.message as Record<string, unknown> | undefined
  const channelId = channel?.id
  const messageTs = (message?.ts as string) || ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  const { userId } = await resolveSlackUser(slackUserId)
  if (!userId) {
    await openDiffErrorModal(payload, 'ユーザー情報が見つかりません')
    return new Response('', { status: 200 })
  }

  const { data: rec } = await supabase
    .from('attendance_records')
    .select('id, user_id, date, project_id, staff_id, clock_in, clock_out, break_minutes, slack_diff_thread_ts, slack_diff_channel_id')
    .eq('id', attendanceRecordId)
    .is('deleted_at', null)
    .single()

  if (!rec || rec.user_id !== userId) {
    await openDiffErrorModal(payload, ':warning: ご自身の打刻のみ修正できます')
    return new Response('', { status: 200 })
  }

  // 同日のシフト (start/end pre-fill)
  const { data: s } = await supabase
    .from('shifts')
    .select('start_time, end_time')
    .eq('staff_id', rec.staff_id)
    .eq('shift_date', rec.date)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  const shift = (s as unknown as { start_time: string; end_time: string } | null) || null

  const initialInTime = shift?.start_time ? shift.start_time.slice(0, 5) : '09:00'
  const initialOutTime = shift?.end_time ? shift.end_time.slice(0, 5) : '18:00'

  const threadTs = (rec.slack_diff_thread_ts as string) || messageTs
  const replyChannel = (rec.slack_diff_channel_id as string) || channelId

  await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trigger_id: payload.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'diff_member_fix_modal',
        private_metadata: JSON.stringify({
          attendanceRecordId,
          threadTs,
          channelId: replyChannel,
        }),
        title: { type: 'plain_text', text: '打刻修正入力' },
        submit: { type: 'plain_text', text: '送信' },
        close: { type: 'plain_text', text: 'キャンセル' },
        blocks: [
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `対象日: *${rec.date}*` }],
          },
          {
            type: 'input',
            block_id: 'clock_in_date',
            element: { type: 'datepicker', action_id: 'v', initial_date: rec.date },
            label: { type: 'plain_text', text: '出勤 日付' },
          },
          {
            type: 'input',
            block_id: 'clock_in_time',
            element: { type: 'timepicker', action_id: 'v', initial_time: initialInTime },
            label: { type: 'plain_text', text: '出勤 時刻' },
          },
          {
            type: 'input',
            block_id: 'clock_out_date',
            optional: true,
            element: { type: 'datepicker', action_id: 'v', initial_date: rec.date },
            label: { type: 'plain_text', text: '退勤 日付' },
          },
          {
            type: 'input',
            block_id: 'clock_out_time',
            optional: true,
            element: { type: 'timepicker', action_id: 'v', initial_time: initialOutTime },
            label: { type: 'plain_text', text: '退勤 時刻' },
          },
          {
            type: 'input',
            block_id: 'break_minutes',
            element: {
              type: 'plain_text_input',
              action_id: 'v',
              initial_value: String(rec.break_minutes ?? 60),
            },
            label: { type: 'plain_text', text: '休憩（分）' },
          },
          {
            type: 'input',
            block_id: 'reason',
            element: {
              type: 'plain_text_input',
              action_id: 'v',
              multiline: true,
              placeholder: { type: 'plain_text', text: '修正理由を入力してください' },
            },
            label: { type: 'plain_text', text: '修正理由' },
          },
        ],
      },
    }),
  })

  return new Response('', { status: 200 })
}

async function openDiffErrorModal(payload: Record<string, unknown>, text: string) {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) return
  await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trigger_id: payload.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'diff_error',
        title: { type: 'plain_text', text: 'エラー' },
        close: { type: 'plain_text', text: '閉じる' },
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text } },
        ],
      },
    }),
  })
}

async function sendDiffEphemeral(channelId: string | undefined, slackUserId: string, text: string) {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken || !channelId) return
  try {
    await fetch('https://slack.com/api/chat.postEphemeral', {
      method: 'POST',
      headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: channelId, user: slackUserId, text }),
    })
  } catch (e) {
    console.error('sendDiffEphemeral error:', e)
  }
}

// ---- diff_member_fix_modal の送信処理 ----
async function handleDiffMemberFixSubmit(payload: Record<string, unknown>) {
  const view = payload.view as Record<string, unknown>
  const metadata = JSON.parse((view?.private_metadata as string) || '{}')
  const { attendanceRecordId, threadTs, channelId } = metadata as {
    attendanceRecordId: string
    threadTs: string
    channelId: string
  }
  const user = payload.user as Record<string, string>
  const slackUserId = user?.id

  const state = view?.state as Record<string, Record<string, Record<string, Record<string, unknown>>>>
  const v = state?.values || {}
  const getVal = (block: string) => (v[block]?.v?.value as string) || ''
  const getDate = (block: string) => (v[block]?.v?.selected_date as string) || ''
  const getTime = (block: string) => (v[block]?.v?.selected_time as string) || ''

  const inDate = getDate('clock_in_date')
  const inTime = getTime('clock_in_time')
  const outDate = getDate('clock_out_date')
  const outTime = getTime('clock_out_time')
  const breakMinStr = getVal('break_minutes')
  const reason = getVal('reason')

  if (!reason.trim()) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { reason: '修正理由は必須です' },
    })
  }

  const toIso = (date: string, time: string): string | null => {
    if (!date || !time) return null
    const d = new Date(`${date}T${time}:00+09:00`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  const requestedClockIn = toIso(inDate, inTime)
  const requestedClockOut = outDate && outTime ? toIso(outDate, outTime) : null
  const breakMinutes = parseInt(breakMinStr, 10)

  const { userId, displayName } = await resolveSlackUser(slackUserId)
  if (!userId) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { reason: 'ユーザー情報が見つかりません' },
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  const { data: rec } = await supabase
    .from('attendance_records')
    .select('*, project:project_id(id, name, slack_channel_id)')
    .eq('id', attendanceRecordId)
    .is('deleted_at', null)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = rec as any
  if (!r || r.user_id !== userId) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { reason: 'ご自身の打刻のみ修正できます' },
    })
  }

  const { data: created } = await supabase
    .from('attendance_correction_requests')
    .insert({
      attendance_record_id: r.id,
      requested_by_user_id: userId,
      project_id: r.project_id,
      original_clock_in: r.clock_in,
      original_clock_out: r.clock_out,
      original_break_minutes: r.break_minutes,
      original_note: r.note,
      requested_clock_in: requestedClockIn ?? r.clock_in,
      requested_clock_out: requestedClockOut ?? r.clock_out,
      requested_break_minutes: isNaN(breakMinutes) ? r.break_minutes : breakMinutes,
      requested_note: r.note,
      reason,
      status: 'pending',
      // 元の乖離通知スレッドに紐付ける
      slack_thread_ts: threadTs || null,
    })
    .select()
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = created as any
  if (!c) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { reason: '申請の作成に失敗しました' },
    })
  }

  // 元の乖離スレッドへリプライ (承認/差戻しボタン付き)
  try {
    const fmt = (s: string | null) =>
      s
        ? new Date(s).toLocaleString('ja-JP', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Tokyo',
          })
        : '-'
    const text = `:memo: *${displayName || 'メンバー'}* さんから打刻修正の申請\n• 出勤: ${fmt(r.clock_in)} → ${fmt(requestedClockIn ?? r.clock_in)}\n• 退勤: ${fmt(r.clock_out)} → ${fmt(requestedClockOut ?? r.clock_out)}\n• 休憩: ${r.break_minutes ?? 0}分 → ${isNaN(breakMinutes) ? r.break_minutes ?? 0 : breakMinutes}分\n• 理由: ${reason}`
    const blocks: SlackBlock[] = [
      { type: 'section', text: { type: 'mrkdwn', text } },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            style: 'primary',
            text: { type: 'plain_text', text: '承認' },
            action_id: 'correction_approve',
            value: c.id,
          },
          {
            type: 'button',
            style: 'danger',
            text: { type: 'plain_text', text: '差戻し' },
            action_id: 'correction_reject',
            value: c.id,
          },
        ],
      } as unknown as SlackBlock,
    ]
    if (channelId && threadTs) {
      await sendSlackBotMessage(channelId, { text, blocks }, { thread_ts: threadTs })
    }
  } catch (e) {
    console.error('diff_member_fix_modal notify error:', e)
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
