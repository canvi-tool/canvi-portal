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

    // Only handle block_actions
    if (payload.type !== 'block_actions') {
      return new Response('', { status: 200 })
    }

    const action = payload.actions?.[0]
    if (!action) return new Response('', { status: 200 })

    const actionId = action.action_id // 'report_approve' or 'report_reject'
    const reportId = action.value // the report ID

    if (!['report_approve', 'report_reject'].includes(actionId)) {
      return new Response('', { status: 200 })
    }

    // Get the Slack user who clicked
    const slackUserId = payload.user?.id
    // payload.user.name available for logging if needed

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
      await updateSlackMessage(payload, '❌ 日報が見つかりません')
      return new Response('', { status: 200 })
    }

    // Check if already processed
    if (report.status === 'approved' || report.status === 'rejected') {
      const statusLabel = report.status === 'approved' ? '承認済み' : '差戻し済み'
      await updateSlackMessage(payload, `⚠️ この日報は既に${statusLabel}です`)
      return new Response('', { status: 200 })
    }

    const newStatus = actionId === 'report_approve' ? 'approved' : 'rejected'

    // Find the staff record for the Slack user who clicked (to set approved_by)
    // Look up by slack_user_id in staff table or custom_fields
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

    // Update the report
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
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
      await updateSlackMessage(payload, `❌ 更新に失敗しました: ${updateError.message}`)
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
      const res = await fetch('https://slack.com/api/chat.update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: payload.channel?.id,
          ts: payload.message?.ts,
          text: `${emoji} ${staffName} の ${typeLabel} が${actionLabel}されました（${projectName}）`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${emoji} *${staffName}* の *${typeLabel}* が *${actionLabel}* されました\n📅 ${report.report_date} | 🏢 ${projectName}`,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `${actionLabel}者: <@${slackUserId}> | ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
                },
              ],
            },
          ],
        }),
      })
      const result = await res.json()
      if (!result.ok) {
        console.error('chat.update failed:', result.error)
      }
    }

    return new Response('', { status: 200 })
  } catch (error) {
    console.error('Slack interaction error:', error)
    return new Response('', { status: 200 }) // Always return 200 to Slack
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateSlackMessage(payload: any, text: string) {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) return

  await fetch('https://slack.com/api/chat.update', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: payload.channel?.id,
      ts: payload.message?.ts,
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
