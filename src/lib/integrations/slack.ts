/**
 * Slack通知連携
 * Incoming Webhook を使用してSlackにメッセージを送信する
 */

export interface SlackMessage {
  text: string
  blocks?: SlackBlock[]
  channel?: string // override channel
  username?: string
  icon_emoji?: string
}

export interface SlackBlock {
  type: 'section' | 'header' | 'divider' | 'context' | 'actions'
  text?: {
    type: 'mrkdwn' | 'plain_text'
    text: string
    emoji?: boolean
  }
  fields?: {
    type: 'mrkdwn' | 'plain_text'
    text: string
  }[]
  elements?: Record<string, unknown>[]
  block_id?: string
}

// イベントタイプ定義
export type SlackEventType =
  | 'attendance_clock_in'
  | 'attendance_clock_out'
  | 'attendance_missing'        // 打刻漏れ
  | 'attendance_shift_mismatch' // シフトvs打刻乖離
  | 'shift_submitted'
  | 'shift_approved'
  | 'shift_rejected'
  | 'report_submitted'
  | 'report_overdue'            // 日報未提出
  | 'contract_unsigned'
  | 'payment_anomaly'
  | 'leave_requested'
  | 'overtime_warning'
  | 'general_alert'

// デフォルトのWebhook URL
function getWebhookUrl(): string | null {
  return process.env.SLACK_WEBHOOK_URL || null
}

// アラート専用のWebhook URL（分離する場合）
function getAlertWebhookUrl(): string | null {
  return process.env.SLACK_ALERT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || null
}

/**
 * Slackにメッセージを送信
 */
export async function sendSlackMessage(message: SlackMessage): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = getWebhookUrl()
  if (!webhookUrl) {
    console.warn('SLACK_WEBHOOK_URL is not configured, skipping Slack notification')
    return { success: false, error: 'Slack Webhook URLが設定されていません' }
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message.text,
        blocks: message.blocks,
        channel: message.channel,
        username: message.username || 'Canvi Portal',
        icon_emoji: message.icon_emoji || ':office:',
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Slack webhook error:', text)
      return { success: false, error: `Slack API error: ${res.status}` }
    }

    return { success: true }
  } catch (err) {
    console.error('Slack send error:', err)
    return { success: false, error: (err as Error).message }
  }
}

/**
 * アラートチャンネルにメッセージを送信
 */
export async function sendSlackAlert(message: SlackMessage): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = getAlertWebhookUrl()
  if (!webhookUrl) {
    return { success: false, error: 'Slack Alert Webhook URLが設定されていません' }
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message.text,
        blocks: message.blocks,
        username: message.username || 'Canvi Alert',
        icon_emoji: message.icon_emoji || ':rotating_light:',
      }),
    })

    if (!res.ok) {
      return { success: false, error: `Slack API error: ${res.status}` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// =============== 通知テンプレート ===============

/**
 * 出勤通知
 */
export function buildClockInNotification(staffName: string, projectName?: string, time?: string): SlackMessage {
  const timeStr = time || new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
  return {
    text: `${staffName}さんが出勤しました (${timeStr})`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:green_circle: *${staffName}* さんが出勤しました`,
        },
        fields: [
          { type: 'mrkdwn', text: `*時刻:* ${timeStr}` },
          { type: 'mrkdwn', text: `*PJ:* ${projectName || '未選択'}` },
        ],
      },
    ],
  }
}

/**
 * 退勤通知
 */
export function buildClockOutNotification(staffName: string, workHours: string, time?: string): SlackMessage {
  const timeStr = time || new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
  return {
    text: `${staffName}さんが退勤しました (${timeStr}, 勤務${workHours})`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:red_circle: *${staffName}* さんが退勤しました`,
        },
        fields: [
          { type: 'mrkdwn', text: `*時刻:* ${timeStr}` },
          { type: 'mrkdwn', text: `*勤務時間:* ${workHours}` },
        ],
      },
    ],
  }
}

/**
 * 打刻漏れアラート
 */
export function buildMissingClockNotification(staffNames: string[], date: string): SlackMessage {
  const nameList = staffNames.map(n => `• ${n}`).join('\n')
  return {
    text: `【打刻漏れ】${date} - ${staffNames.length}名が未打刻です`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `⚠️ 打刻漏れ検知 (${date})`, emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `シフト登録済みですが打刻がないメンバー:\n${nameList}`,
        },
      },
    ],
  }
}

/**
 * 日報未提出リマインド
 */
export function buildReportOverdueNotification(staffNames: string[], date: string): SlackMessage {
  const nameList = staffNames.map(n => `• ${n}`).join('\n')
  return {
    text: `【日報未提出】${date} - ${staffNames.length}名が未提出です`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `📝 日報未提出リマインド (${date})`, emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `以下のメンバーの日報が未提出です:\n${nameList}`,
        },
      },
    ],
  }
}

/**
 * 残業警告
 */
export function buildOvertimeWarningNotification(staffName: string, hours: number, date: string): SlackMessage {
  return {
    text: `【残業警告】${staffName}さんの勤務時間が${hours}時間を超えています (${date})`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:warning: *残業警告* — *${staffName}* さんの勤務時間が *${hours}時間* を超えています (${date})`,
        },
      },
    ],
  }
}

/**
 * 汎用アラート通知
 */
export function buildGeneralAlertNotification(title: string, message: string, severity: 'info' | 'warning' | 'critical'): SlackMessage {
  const emoji = severity === 'critical' ? ':rotating_light:' : severity === 'warning' ? ':warning:' : ':information_source:'
  return {
    text: `【${severity.toUpperCase()}】${title}: ${message}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *${title}*\n${message}`,
        },
      },
    ],
  }
}
