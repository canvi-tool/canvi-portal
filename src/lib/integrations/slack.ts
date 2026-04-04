/**
 * Slack通知連携
 * Bot Token (chat.postMessage) + Incoming Webhook のハイブリッド方式
 * - Bot Token: プロジェクト紐付けチャンネルへの送信（動的チャンネル指定）
 * - Webhook: フォールバック / 汎用通知
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'

// 通知設定のトグルキー名
export type NotificationToggleKey =
  | 'attendance_clock_in'
  | 'attendance_clock_out'
  | 'attendance_missing'
  | 'shift_submitted'
  | 'shift_approved'
  | 'shift_rejected'
  | 'report_submitted'
  | 'report_overdue'
  | 'overtime_warning'
  | 'leave_requested'
  | 'member_assigned'
  | 'member_removed'
  | 'general_alert'

// デフォルト通知設定（settings未作成の場合）
const DEFAULT_NOTIFICATION_TOGGLES: Record<NotificationToggleKey, boolean> = {
  attendance_clock_in: false,
  attendance_clock_out: false,
  attendance_missing: true,
  shift_submitted: false,
  shift_approved: false,
  shift_rejected: true,
  report_submitted: false,
  report_overdue: true,
  overtime_warning: true,
  leave_requested: true,
  member_assigned: true,
  member_removed: true,
  general_alert: true,
}

/**
 * プロジェクトの通知設定を取得して、指定イベントが有効かチェック
 * 設定がない場合はデフォルト値を使用
 */
export async function isNotificationEnabled(
  projectId: string | null | undefined,
  eventType: NotificationToggleKey
): Promise<boolean> {
  if (!projectId) {
    // プロジェクト未指定の場合はデフォルト設定を使用
    return DEFAULT_NOTIFICATION_TOGGLES[eventType] ?? false
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('project_notification_settings')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (error || !data) {
      // 設定がない場合はデフォルト
      return DEFAULT_NOTIFICATION_TOGGLES[eventType] ?? false
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as Record<string, any>)[eventType] === true
  } catch {
    return DEFAULT_NOTIFICATION_TOGGLES[eventType] ?? false
  }
}

/**
 * 通知設定をチェックしてからプロジェクト通知を送信
 * 設定がOFFの場合はスキップ
 */
export async function sendProjectNotificationIfEnabled(
  message: SlackMessage,
  projectId: string | null | undefined,
  projectSlackChannelId: string | null | undefined,
  eventType: NotificationToggleKey
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const enabled = await isNotificationEnabled(projectId, eventType)
  if (!enabled) {
    return { success: true, skipped: true }
  }
  return sendProjectNotification(message, projectSlackChannelId)
}

export interface SlackMessage {
  text: string
  blocks?: SlackBlock[]
  channel?: string // channel ID for Bot Token method
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

export interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  is_archived: boolean
  num_members?: number
  topic?: string
  purpose?: string
}

// イベントタイプ定義
export type SlackEventType =
  | 'attendance_clock_in'
  | 'attendance_clock_out'
  | 'attendance_missing'
  | 'attendance_shift_mismatch'
  | 'shift_submitted'
  | 'shift_approved'
  | 'shift_rejected'
  | 'report_submitted'
  | 'report_overdue'
  | 'contract_unsigned'
  | 'payment_anomaly'
  | 'leave_requested'
  | 'overtime_warning'
  | 'general_alert'

// Bot Token
function getBotToken(): string | null {
  return process.env.SLACK_BOT_TOKEN || null
}

// デフォルトのWebhook URL（フォールバック）
function getWebhookUrl(): string | null {
  return process.env.SLACK_WEBHOOK_URL || null
}

// アラート専用のWebhook URL
function getAlertWebhookUrl(): string | null {
  return process.env.SLACK_ALERT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || null
}

// デフォルト通知チャンネル
function getDefaultChannelId(): string | null {
  return process.env.SLACK_DEFAULT_CHANNEL_ID || null
}

/**
 * Bot Token方式でSlackにメッセージを送信（chat.postMessage）
 * プロジェクト紐付けチャンネルに送信する場合はこちらを使用
 */
export async function sendSlackBotMessage(
  channelId: string,
  message: SlackMessage
): Promise<{ success: boolean; error?: string }> {
  const token = getBotToken()
  if (!token) {
    // フォールバック: Webhook方式で送信
    console.warn('SLACK_BOT_TOKEN is not configured, falling back to webhook')
    return sendSlackMessage(message)
  }

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel: channelId,
        text: message.text,
        blocks: message.blocks,
        username: message.username || 'Canvi Portal',
        icon_emoji: message.icon_emoji || ':office:',
      }),
    })

    const data = await res.json()
    if (!data.ok) {
      console.error('Slack chat.postMessage error:', data.error)
      return { success: false, error: `Slack API error: ${data.error}` }
    }

    return { success: true }
  } catch (err) {
    console.error('Slack Bot send error:', err)
    return { success: false, error: (err as Error).message }
  }
}

/**
 * プロジェクト紐付けチャンネルに通知送信
 * channelId がある場合はBot Token方式、なければWebhook/デフォルトチャンネルにフォールバック
 */
export async function sendProjectNotification(
  message: SlackMessage,
  projectSlackChannelId?: string | null
): Promise<{ success: boolean; error?: string }> {
  const channelId = projectSlackChannelId || getDefaultChannelId()

  if (channelId && getBotToken()) {
    return sendSlackBotMessage(channelId, message)
  }

  // フォールバック: Webhook方式
  return sendSlackMessage(message)
}

/**
 * Slackにメッセージを送信（Webhook方式 - フォールバック/汎用）
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

/**
 * Slackチャンネル一覧を取得（Bot Token方式）
 */
export async function fetchSlackChannels(): Promise<{ channels: SlackChannel[]; error?: string }> {
  const token = getBotToken()
  if (!token) {
    return { channels: [], error: 'SLACK_BOT_TOKEN is not configured' }
  }

  try {
    const allChannels: SlackChannel[] = []
    let cursor: string | undefined

    // ページネーション対応（最大500件）
    do {
      const params = new URLSearchParams({
        types: 'public_channel,private_channel',
        exclude_archived: 'true',
        limit: '200',
      })
      if (cursor) params.set('cursor', cursor)

      const res = await fetch(`https://slack.com/api/conversations.list?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await res.json()
      if (!data.ok) {
        return { channels: [], error: `Slack API error: ${data.error}` }
      }

      for (const ch of data.channels || []) {
        allChannels.push({
          id: ch.id,
          name: ch.name,
          is_private: ch.is_private,
          is_archived: ch.is_archived,
          num_members: ch.num_members,
          topic: ch.topic?.value,
          purpose: ch.purpose?.value,
        })
      }

      cursor = data.response_metadata?.next_cursor
    } while (cursor && allChannels.length < 500)

    // 名前順ソート
    allChannels.sort((a, b) => a.name.localeCompare(b.name))

    return { channels: allChannels }
  } catch (err) {
    return { channels: [], error: (err as Error).message }
  }
}

/**
 * Slackチャンネルを新規作成（Bot Token方式）
 */
export async function createSlackChannel(
  name: string,
  isPrivate: boolean = false
): Promise<{ channel?: SlackChannel; error?: string }> {
  const token = getBotToken()
  if (!token) {
    return { error: 'SLACK_BOT_TOKEN is not configured' }
  }

  try {
    const res = await fetch('https://slack.com/api/conversations.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_\u3000-\u9fff\uff00-\uffef]/g, ''),
        is_private: isPrivate,
      }),
    })

    const data = await res.json()
    if (!data.ok) {
      // よくあるエラーの日本語化
      const errorMessages: Record<string, string> = {
        'name_taken': 'このチャンネル名は既に使用されています',
        'invalid_name': 'チャンネル名が無効です（英数字・ハイフン・アンダースコアのみ）',
        'no_channel': 'チャンネルの作成に失敗しました',
        'restricted_action': 'Botにチャンネル作成の権限がありません',
        'missing_scope': 'Botにチャンネル作成のスコープ(channels:manage)がありません',
      }
      return { error: errorMessages[data.error] || `Slack API error: ${data.error}` }
    }

    return {
      channel: {
        id: data.channel.id,
        name: data.channel.name,
        is_private: data.channel.is_private,
        is_archived: false,
        num_members: 1,
      },
    }
  } catch (err) {
    return { error: (err as Error).message }
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
export function buildClockOutNotification(staffName: string, workHours: string, time?: string, projectName?: string): SlackMessage {
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
          ...(projectName ? [{ type: 'mrkdwn' as const, text: `*PJ:* ${projectName}` }] : []),
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
 * 休憩開始通知
 */
export function buildBreakStartNotification(staffName: string, time?: string): SlackMessage {
  const timeStr = time || new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
  return {
    text: `${staffName}さんが休憩に入りました (${timeStr})`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:coffee: *${staffName}* さんが休憩に入りました (${timeStr})`,
        },
      },
    ],
  }
}

/**
 * 休憩終了通知
 */
export function buildBreakEndNotification(staffName: string, breakMinutes: number, time?: string): SlackMessage {
  const timeStr = time || new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
  return {
    text: `${staffName}さんが休憩から戻りました (${timeStr}, 休憩${breakMinutes}分)`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:arrow_forward: *${staffName}* さんが休憩から戻りました (${timeStr}, 休憩${breakMinutes}分)`,
        },
      },
    ],
  }
}

/**
 * シフト提出通知
 */
export function buildShiftSubmittedNotification(staffName: string, shiftDate: string, startTime: string, endTime: string): SlackMessage {
  return {
    text: `${staffName}さんがシフトを提出しました (${shiftDate})`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:calendar: *${staffName}* さんがシフトを提出しました`,
        },
        fields: [
          { type: 'mrkdwn', text: `*日付:* ${shiftDate}` },
          { type: 'mrkdwn', text: `*時間:* ${startTime} 〜 ${endTime}` },
        ],
      },
    ],
  }
}

/**
 * シフト提出期限超過アラート
 */
export function buildShiftOverdueNotification(staffNames: string[], deadline: string, projectName: string): SlackMessage {
  const nameList = staffNames.map(n => `• ${n}`).join('\n')
  return {
    text: `【シフト未提出】${projectName} - ${staffNames.length}名が期限(${deadline})を超過`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `📅 シフト未提出アラート`, emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${projectName}* のシフト提出期限(${deadline})を超過しているメンバー:\n${nameList}`,
        },
      },
    ],
  }
}

/**
 * 日報提出通知
 */
export function buildReportSubmittedNotification(staffName: string, date: string, workHours?: string): SlackMessage {
  return {
    text: `${staffName}さんが日報を提出しました (${date})`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:memo: *${staffName}* さんが日報を提出しました`,
        },
        fields: [
          { type: 'mrkdwn', text: `*日付:* ${date}` },
          ...(workHours ? [{ type: 'mrkdwn' as const, text: `*勤務時間:* ${workHours}` }] : []),
        ],
      },
    ],
  }
}

/**
 * メンバーアサイン通知
 */
export function buildMemberAssignedNotification(staffName: string, projectName: string, role?: string): SlackMessage {
  return {
    text: `${staffName}さんが${projectName}にアサインされました`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:wave: *${staffName}* さんが *${projectName}* にアサインされました${role ? ` (${role})` : ''}`,
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
