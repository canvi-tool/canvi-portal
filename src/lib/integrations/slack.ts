/**
 * Slack通知連携
 * Bot Token (chat.postMessage) + Incoming Webhook のハイブリッド方式
 * - Bot Token: プロジェクト紐付けチャンネルへの送信（動的チャンネル指定）
 * - Webhook: フォールバック / 汎用通知
 */

import { createAdminClient } from '@/lib/supabase/admin'

// 通知設定のトグルキー名
export type NotificationToggleKey =
  | 'attendance_clock_in'
  | 'attendance_break_start'
  | 'attendance_break_end'
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

// デフォルト通知設定（settings未作成の場合）
// 出退勤はスレッド化のため必ずON（thread_ts取得に必要）
const DEFAULT_NOTIFICATION_TOGGLES: Record<NotificationToggleKey, boolean> = {
  attendance_clock_in: true,
  attendance_break_start: false,
  attendance_break_end: false,
  attendance_clock_out: true,
  attendance_missing: true,
  shift_submitted: false,
  shift_approved: false,
  shift_rejected: true,
  report_submitted: true,
  report_overdue: true,
  overtime_warning: true,
  leave_requested: true,
  member_assigned: true,
  member_removed: true,
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
    const supabase = createAdminClient()
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
  eventType: NotificationToggleKey,
  options?: { thread_ts?: string; staffId?: string | string[] | null; noMention?: boolean }
): Promise<{ success: boolean; error?: string; skipped?: boolean; ts?: string }> {
  const enabled = await isNotificationEnabled(projectId, eventType)
  if (!enabled) {
    return { success: true, skipped: true }
  }
  return sendProjectNotification(message, projectSlackChannelId, {
    thread_ts: options?.thread_ts,
    ...(options?.noMention ? {} : { projectId, staffId: options?.staffId }),
  })
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

// ---- Token Cache (DB fallback for Vercel env var injection issues) ----
// Vercelの一部サーバーレス関数でprocess.envが見えない問題を回避するため、
// DBから取得したトークンをメモリキャッシュする。
const _tokenCache: Record<string, string | null> = {}

/**
 * system_settings テーブルからトークンを取得（DBフォールバック）
 * process.env が利用できない場合のバックアップ
 */
async function getSettingFromDB(key: string): Promise<string | null> {
  if (_tokenCache[key] !== undefined) return _tokenCache[key]
  try {
    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single()
    if (error || !data) {
      console.warn(`[getSettingFromDB] Failed to read ${key}: ${error?.message || 'not found'}`)
      _tokenCache[key] = null
      return null
    }
    const val = (data as { value: string }).value
    console.log(`[getSettingFromDB] Got ${key} from DB (len=${val.length})`)
    _tokenCache[key] = val
    return val
  } catch (err) {
    console.error(`[getSettingFromDB] Error reading ${key}:`, err)
    _tokenCache[key] = null
    return null
  }
}

// Bot Token (sync: env var only)
function getBotToken(): string | null {
  return process.env.SLACK_BOT_TOKEN || null
}

/**
 * Bot Token を確実に取得（env var → DB fallback）
 * Vercelの一部関数でprocess.envが見えない問題を回避
 */
async function getBotTokenSafe(): Promise<string | null> {
  const envToken = process.env.SLACK_BOT_TOKEN
  if (envToken) return envToken
  console.warn('[getBotTokenSafe] process.env.SLACK_BOT_TOKEN is null, trying DB fallback...')
  return getSettingFromDB('SLACK_BOT_TOKEN')
}

// User OAuth Token（ユーザー招待・プロフィール更新に必要）
function getUserToken(): string | null {
  return process.env.SLACK_USER_TOKEN || null
}

/**
 * User Token を確実に取得（env var → DB fallback）
 */
async function getUserTokenSafe(): Promise<string | null> {
  const envToken = process.env.SLACK_USER_TOKEN
  if (envToken) return envToken
  return getSettingFromDB('SLACK_USER_TOKEN')
}

// Usergroup API用トークン
// Bot tokenではpermission_deniedになるため、User tokenを優先使用
// SLACK_USER_TOKEN未設定時はSLACK_BOT_TOKENにフォールバック（後方互換）
function getUsergroupToken(): string {
  return process.env.SLACK_USER_TOKEN || process.env.SLACK_BOT_TOKEN || ''
}

/**
 * Usergroup Token を確実に取得（env var → DB fallback）
 */
async function getUsergroupTokenSafe(): Promise<string> {
  const userToken = await getUserTokenSafe()
  if (userToken) return userToken
  const botToken = await getBotTokenSafe()
  return botToken || ''
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
  message: SlackMessage,
  options?: { thread_ts?: string; reply_broadcast?: boolean }
): Promise<{ success: boolean; error?: string; ts?: string }> {
  const token = await getBotTokenSafe()
  if (!token) {
    // フォールバック: Webhook方式で送信
    console.warn('SLACK_BOT_TOKEN is not configured (env + DB both failed), falling back to webhook')
    return sendSlackMessage(message)
  }

  try {
    const payload = {
      channel: channelId,
      text: message.text,
      blocks: message.blocks,
      username: message.username || 'Canvi Portal',
      icon_emoji: message.icon_emoji || ':office:',
      ...(options?.thread_ts ? { thread_ts: options.thread_ts } : {}),
      ...(options?.reply_broadcast ? { reply_broadcast: true } : {}),
    }
    console.log(`[thread] sendSlackBotMessage: channel=${channelId}, thread_ts=${options?.thread_ts || 'NONE'}`)

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!data.ok) {
      console.error('Slack chat.postMessage error:', data.error)
      return { success: false, error: `Slack API error: ${data.error}` }
    }

    return { success: true, ts: data.ts }
  } catch (err) {
    console.error('Slack Bot send error:', err)
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Bot Token方式でSlackメッセージを編集（chat.update）
 */
export async function updateSlackBotMessage(
  channelId: string,
  ts: string,
  message: SlackMessage
): Promise<{ success: boolean; error?: string }> {
  const token = await getBotTokenSafe()
  if (!token) {
    return { success: false, error: 'SLACK_BOT_TOKEN is not configured (env + DB both failed)' }
  }

  try {
    const res = await fetch('https://slack.com/api/chat.update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel: channelId,
        ts,
        text: message.text,
        blocks: message.blocks,
      }),
    })

    const data = await res.json()
    if (!data.ok) {
      console.error('Slack chat.update error:', data.error)
      return { success: false, error: `Slack API error: ${data.error}` }
    }
    return { success: true }
  } catch (err) {
    console.error('Slack chat.update send error:', err)
    return { success: false, error: (err as Error).message }
  }
}

/**
 * プロジェクトの管理者以上（admin/owner）のSlack User IDを取得
 * + 指定されたスタッフ本人のSlack User IDも取得
 * メンション文字列を生成して返す
 */
export async function getProjectMentionText(
  projectId?: string | null,
  selfStaffId?: string | string[] | null
): Promise<string> {
  if (!(await getBotTokenSafe())) return ''

  const supabase = createAdminClient()
  const slackUserIds: Set<string> = new Set()

  // 本人のSlack User IDを取得（単一または複数対応）
  const staffIds = selfStaffId
    ? (Array.isArray(selfStaffId) ? selfStaffId : [selfStaffId])
    : []

  if (staffIds.length > 0) {
    const { data: staffList } = await supabase
      .from('staff')
      .select('id, email, custom_fields')
      .in('id', staffIds)

    for (const staff of staffList || []) {
      const cf = (staff.custom_fields as Record<string, unknown>) || {}
      let slackId = cf.slack_user_id as string | undefined
      if (!slackId && staff.email) {
        const lookup = await lookupSlackUserByEmail(staff.email)
        if (lookup.slackUserId) {
          slackId = lookup.slackUserId
          const updatedCf = { ...cf, slack_user_id: slackId }
          await supabase
            .from('staff')
            .update({ custom_fields: updatedCf })
            .eq('id', staff.id)
        }
      }
      if (slackId) slackUserIds.add(slackId)
    }
  }

  // PJにアサインされた管理者以上のSlack User IDを取得
  if (projectId) {
    // project_assignmentsから該当PJのアサイン済みスタッフを取得（deleted_at=nullのみ）
    const { data: assignments, error: assignErr } = await supabase
      .from('project_assignments')
      .select('staff_id, status, staff:staff_id(id, user_id, email, custom_fields)')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .in('status', ['confirmed', 'in_progress'])

    console.log(`[mention] projectId=${projectId}, assignments=${assignments?.length ?? 0}, err=${assignErr?.message ?? 'none'}`)
    if (assignments && assignments.length > 0) {
      // アサインメンバーのuser_idを収集
      const userIds = assignments
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((a: any) => a.staff?.user_id)
        .filter(Boolean) as string[]

      console.log(`[mention] assigned userIds: ${JSON.stringify(userIds)}`)

      if (userIds.length > 0) {
        // admin/ownerロールを持つユーザーをフィルタ
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id, role:role_id(name)')
          .in('user_id', userIds)

        console.log(`[mention] adminRoles: ${JSON.stringify(adminRoles)}`)

        const adminUserIds = new Set(
          (adminRoles || [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((ur: any) => {
              const roleName = ur.role?.name
              return roleName === 'admin' || roleName === 'owner'
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((ur: any) => ur.user_id as string)
        )

        console.log(`[mention] adminUserIds for PJ: ${JSON.stringify([...adminUserIds])}`)

        // PJアサイン済み管理者のSlack User IDを収集
        for (const assignment of assignments) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const staff = (assignment as any).staff
          if (!staff || !adminUserIds.has(staff.user_id)) continue

          console.log(`[mention] adding admin staff: ${staff.email} (staff.id=${staff.id})`)
          const cf = (staff.custom_fields as Record<string, unknown>) || {}
          let slackId = cf.slack_user_id as string | undefined
          if (!slackId && staff.email) {
            const lookup = await lookupSlackUserByEmail(staff.email)
            if (lookup.slackUserId) {
              slackId = lookup.slackUserId
              const updatedCf = { ...cf, slack_user_id: slackId }
              await supabase
                .from('staff')
                .update({ custom_fields: updatedCf })
                .eq('id', staff.id)
            }
          }
          if (slackId) slackUserIds.add(slackId)
        }
      }
    }
  }

  if (slackUserIds.size === 0) return ''
  return Array.from(slackUserIds).map(id => `<@${id}>`).join(' ')
}

/**
 * プロジェクト紐付けチャンネルに通知送信
 * Bot Token + channelId で送信し、tsを返す（スレッド化に必須）
 *
 * スレッド化の前提条件:
 * 1. SLACK_BOT_TOKEN が設定されていること
 * 2. プロジェクトに slack_channel_id が設定されていること（または SLACK_DEFAULT_CHANNEL_ID）
 * 3. Botが対象チャンネルに手動で招待済みであること（/invite @BotName）
 *
 * mentions オプション:
 * - projectId + staffId を渡すと、PJ管理者以上 + 本人をメンション付きで通知
 */
export async function sendProjectNotification(
  message: SlackMessage,
  projectSlackChannelId?: string | null,
  options?: { thread_ts?: string; projectId?: string | null; staffId?: string | string[] | null }
): Promise<{ success: boolean; error?: string; ts?: string }> {
  const channelId = projectSlackChannelId || getDefaultChannelId()
  const botToken = await getBotTokenSafe()
  const hasBotToken = !!botToken
  console.log(`[sendProjectNotification] channelId=${channelId}, hasBotToken=${hasBotToken}, hasProjectChannel=${!!projectSlackChannelId}, defaultChannel=${getDefaultChannelId()}`)

  // メンション文字列を生成してメッセージに追加
  if (options?.projectId || options?.staffId) {
    try {
      const mentionText = await getProjectMentionText(options.projectId, options.staffId)
      if (mentionText) {
        // text にメンションを追加（通知に必要）
        message.text = `${mentionText}\n${message.text}`
        // blocks がある場合、先頭にメンション用contextブロックを追加
        if (message.blocks && message.blocks.length > 0) {
          message.blocks.push({
            type: 'context',
            elements: [{ type: 'mrkdwn', text: mentionText }],
          })
        }
      }
    } catch (err) {
      console.warn('メンション生成に失敗:', err)
    }
  }

  if (channelId && hasBotToken) {
    return sendSlackBotMessage(channelId, message, options)
  }

  if (!channelId) {
    console.warn('sendProjectNotification: チャンネルIDが未設定のため通知をスキップ。プロジェクトのslack_channel_idもSLACK_DEFAULT_CHANNEL_IDも未設定です。プロジェクト設定でSlackチャンネルを設定するか、環境変数SLACK_DEFAULT_CHANNEL_IDを設定してください。')
    return { success: false, error: 'Slackチャンネルが未設定です（プロジェクト設定・SLACK_DEFAULT_CHANNEL_ID両方未設定）' }
  }

  // Bot Tokenがない場合のみWebhookフォールバック（tsは返らないためスレッド化不可）
  console.warn(`sendProjectNotification: SLACK_BOT_TOKENが未設定のためWebhookフォールバックで送信します（channelId=${channelId}）。スレッド化・ボタン操作は利用できません。`)
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
  const token = await getBotTokenSafe()
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
  const token = await getBotTokenSafe()
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

// =============== ユーザー検索・チャンネル招待 ===============

/**
 * メールアドレスからSlackユーザーIDを検索（users.lookupByEmail）
 * 必要スコープ: users:read.email
 */
export async function lookupSlackUserByEmail(
  email: string
): Promise<{ slackUserId?: string; error?: string }> {
  const token = await getBotTokenSafe()
  if (!token) {
    return { error: 'SLACK_BOT_TOKEN is not configured' }
  }

  try {
    const params = new URLSearchParams({ email })
    const res = await fetch(`https://slack.com/api/users.lookupByEmail?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await res.json()
    if (!data.ok) {
      if (data.error === 'users_not_found') {
        return { error: `Slackにこのメールアドレスのユーザーが見つかりません: ${email}` }
      }
      if (data.error === 'missing_scope') {
        return { error: 'Botに users:read.email スコープが必要です' }
      }
      return { error: `Slack API error: ${data.error}` }
    }

    return { slackUserId: data.user?.id }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

/**
 * Slackチャンネルにユーザーを招待（conversations.invite）
 * 必要スコープ: channels:manage (public) / groups:write (private)
 */
export async function inviteUserToSlackChannel(
  channelId: string,
  slackUserId: string
): Promise<{ success: boolean; error?: string; alreadyInChannel?: boolean }> {
  const token = await getBotTokenSafe()
  if (!token) {
    return { success: false, error: 'SLACK_BOT_TOKEN is not configured' }
  }

  try {
    const res = await fetch('https://slack.com/api/conversations.invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel: channelId,
        users: slackUserId,
      }),
    })

    const data = await res.json()
    if (!data.ok) {
      if (data.error === 'already_in_channel') {
        return { success: true, alreadyInChannel: true }
      }
      const errorMessages: Record<string, string> = {
        'channel_not_found': 'チャンネルが見つかりません',
        'not_in_channel': 'Botがチャンネルに参加していません',
        'cant_invite_self': '自分自身を招待することはできません',
        'user_not_found': 'ユーザーが見つかりません',
        'cant_invite': 'このユーザーを招待できません',
        'is_archived': 'アーカイブ済みチャンネルには招待できません',
      }
      return { success: false, error: errorMessages[data.error] || `Slack API error: ${data.error}` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * スタッフIDからキャッシュ済みSlack User IDを取得、なければメールで検索してDBに永続化
 * custom_fields.slack_user_id に保存する
 */
export async function resolveSlackUserId(
  staffId: string,
  email: string
): Promise<{ slackUserId?: string; error?: string; cached: boolean }> {
  const supabase = createAdminClient()

  // 1. DBからキャッシュ済みSlack User IDを取得
  const { data: staff } = await supabase
    .from('staff')
    .select('custom_fields')
    .eq('id', staffId)
    .single()

  const cf = (staff?.custom_fields as Record<string, unknown>) || {}
  if (cf.slack_user_id && typeof cf.slack_user_id === 'string') {
    return { slackUserId: cf.slack_user_id, cached: true }
  }

  // 2. キャッシュなし → Slack APIで検索
  const lookup = await lookupSlackUserByEmail(email)
  if (!lookup.slackUserId) {
    return { error: lookup.error || 'Slackユーザーが見つかりません', cached: false }
  }

  // 3. DBに永続化（custom_fields に追記）
  const updatedCf = { ...cf, slack_user_id: lookup.slackUserId }
  await supabase
    .from('staff')
    .update({ custom_fields: updatedCf })
    .eq('id', staffId)

  return { slackUserId: lookup.slackUserId, cached: false }
}

/**
 * メールアドレスからSlackユーザーを検索し、チャンネルに招待する
 * staffIdが渡された場合はSlack User IDをDBに永続化する
 */
export async function inviteStaffToSlackChannel(
  email: string,
  channelId: string,
  staffId?: string
): Promise<{ success: boolean; error?: string; alreadyInChannel?: boolean; slackUserId?: string }> {
  let slackUserId: string | undefined

  if (staffId) {
    // staffIdがある場合はキャッシュ付きの解決を使う
    const resolved = await resolveSlackUserId(staffId, email)
    slackUserId = resolved.slackUserId
    if (!slackUserId) {
      return { success: false, error: resolved.error || 'Slackユーザーが見つかりません' }
    }
  } else {
    // staffIdなしの場合は従来通りメールで検索
    const lookup = await lookupSlackUserByEmail(email)
    slackUserId = lookup.slackUserId
    if (!slackUserId) {
      return { success: false, error: lookup.error || 'Slackユーザーが見つかりません' }
    }
  }

  // チャンネルに招待
  const invite = await inviteUserToSlackChannel(channelId, slackUserId)
  return {
    ...invite,
    slackUserId,
  }
}

/**
 * Slackチャンネルからユーザーをリムーブ（conversations.kick）
 */
export async function removeUserFromSlackChannel(
  channelId: string,
  slackUserId: string
): Promise<{ success: boolean; error?: string; notInChannel?: boolean }> {
  const token = await getBotTokenSafe()
  if (!token) {
    return { success: false, error: 'SLACK_BOT_TOKEN is not configured' }
  }

  try {
    const res = await fetch('https://slack.com/api/conversations.kick', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel: channelId,
        user: slackUserId,
      }),
    })

    const data = await res.json()
    if (!data.ok) {
      if (data.error === 'not_in_channel') {
        return { success: true, notInChannel: true }
      }
      const errorMessages: Record<string, string> = {
        'channel_not_found': 'チャンネルが見つかりません',
        'user_not_found': 'ユーザーが見つかりません',
        'cant_kick_self': '自分自身をリムーブすることはできません',
        'not_in_channel': 'ユーザーはチャンネルに参加していません',
        'restricted_action': 'この操作を実行する権限がありません',
      }
      return { success: false, error: errorMessages[data.error] || `Slack API error: ${data.error}` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * スタッフをSlackチャンネルからリムーブする（Slack User IDをキャッシュから解決）
 */
export async function removeStaffFromSlackChannel(
  email: string,
  channelId: string,
  staffId?: string
): Promise<{ success: boolean; error?: string; notInChannel?: boolean }> {
  let slackUserId: string | undefined

  if (staffId) {
    const resolved = await resolveSlackUserId(staffId, email)
    slackUserId = resolved.slackUserId
    if (!slackUserId) {
      return { success: false, error: resolved.error || 'Slackユーザーが見つかりません' }
    }
  } else {
    const lookup = await lookupSlackUserByEmail(email)
    slackUserId = lookup.slackUserId
    if (!slackUserId) {
      return { success: false, error: lookup.error || 'Slackユーザーが見つかりません' }
    }
  }

  return removeUserFromSlackChannel(channelId, slackUserId)
}

// =============== ユーザー招待・プロフィール更新 ===============

/**
 * Slackワークスペースにユーザーを招待
 * 複数のAPIを順に試行:
 * 1. admin.users.invite (Business+/Enterprise Grid + admin.users:write スコープ)
 * 2. users.admin.invite (レガシー + admin スコープ)
 * 3. フォールバック: 手動招待の案内メッセージ
 */
export async function inviteUserToSlackWorkspace(
  email: string,
  channelIds?: string[]
): Promise<{ success: boolean; error?: string }> {
  const userToken = await getUserTokenSafe()
  const botToken = await getBotTokenSafe()

  if (!userToken && !botToken) {
    return { success: false, error: 'Slack Token が設定されていません。Slack管理画面から手動で招待してください。' }
  }

  const errorMap: Record<string, string> = {
    'already_invited': 'このユーザーは既に招待済みです',
    'already_in_team': 'このユーザーは既にワークスペースに参加しています',
    'already_in_team_invited_user': 'このユーザーは既に招待済みです',
    'sent_recently': '招待メールが最近送信済みです',
    'user_disabled': 'このユーザーは無効化されています',
    'team_not_found': 'ワークスペースが見つかりません',
  }

  // 「既に招待済み」「既に参加済み」は成功扱い
  const isAlreadyInvited = (error: string) =>
    error === 'already_invited' || error === 'already_in_team' || error === 'already_in_team_invited_user'

  // ① admin.users.invite（新API）を試行
  if (userToken) {
    try {
      // team_id が必要なので、まず取得
      const teamRes = await fetch('https://slack.com/api/auth.test', {
        headers: { Authorization: `Bearer ${userToken}` },
      })
      const teamData = await teamRes.json()
      const teamId = teamData.team_id

      if (teamId) {
        const res = await fetch('https://slack.com/api/admin.users.invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            email,
            team_id: teamId,
            channel_ids: channelIds || [],
            is_restricted: false,
          }),
        })
        const data = await res.json()

        if (data.ok) {
          return { success: true }
        }
        if (isAlreadyInvited(data.error)) {
          return { success: true }
        }
        // admin.users:write スコープがない場合はレガシーAPIにフォールバック
        if (data.error !== 'missing_scope' && data.error !== 'not_allowed_token_type' && data.error !== 'access_denied') {
          return { success: false, error: errorMap[data.error] || `Slack API error: ${data.error}` }
        }
        console.log('admin.users.invite failed with scope error, trying legacy API...')
      }
    } catch (err) {
      console.error('admin.users.invite error:', err)
    }

    // ② users.admin.invite（レガシーAPI）を試行
    try {
      const params = new URLSearchParams({ email, set_active: 'true' })
      if (channelIds && channelIds.length > 0) {
        params.set('channels', channelIds.join(','))
      }

      const res = await fetch('https://slack.com/api/users.admin.invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${userToken}`,
        },
        body: params.toString(),
      })
      const data = await res.json()

      if (data.ok) {
        return { success: true }
      }
      if (isAlreadyInvited(data.error)) {
        return { success: true }
      }
      // スコープ不足ならフォールバックへ
      if (data.error !== 'missing_scope' && data.error !== 'not_allowed_token_type') {
        return { success: false, error: errorMap[data.error] || `Slack API error: ${data.error}` }
      }
      console.log('users.admin.invite also failed with scope error, providing manual invite guidance')
    } catch (err) {
      console.error('users.admin.invite error:', err)
    }
  }

  // ③ API招待不可 → Slack管理画面の招待URLを案内
  return {
    success: false,
    error: `Slack招待APIの権限が不足しています。Slack管理画面（https://app.slack.com/admin/invites）から ${email} を手動で招待してください。`,
  }
}

/**
 * Slackユーザーのプロフィール（表示名）を更新
 * User OAuth Token で他ユーザーのプロフィールを更新
 * Bot Token のみの場合はBot自身のプロフィールしか変更できない
 */
export async function updateSlackUserProfile(
  slackUserId: string,
  displayName: string
): Promise<{ success: boolean; error?: string }> {
  // User Token優先、なければBot Token
  const token = (await getUserTokenSafe()) || (await getBotTokenSafe())
  if (!token) {
    return { success: false, error: 'Slack Token が設定されていません' }
  }

  try {
    const res = await fetch('https://slack.com/api/users.profile.set', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        user: slackUserId,
        profile: {
          display_name: displayName,
          real_name: displayName,
        },
      }),
    })

    const data = await res.json()
    if (!data.ok) {
      return { success: false, error: `プロフィール更新失敗: ${data.error}` }
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
  const now = new Date()
  const dateStr = now.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' })
  const timeStr = time || now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
  return {
    text: `${staffName}さんが出勤しました (${dateStr} ${timeStr})`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🟢 *${staffName}* さんが出勤しました`,
        },
        fields: [
          { type: 'mrkdwn', text: `*日時:* ${dateStr} ${timeStr}` },
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
  const now = new Date()
  const dateStr = now.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' })
  const timeStr = time || now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
  return {
    text: `${staffName}さんが退勤しました (${dateStr} ${timeStr}, 勤務${workHours})`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔴 *${staffName}* さんが退勤しました`,
        },
        fields: [
          { type: 'mrkdwn', text: `*日時:* ${dateStr} ${timeStr}` },
          { type: 'mrkdwn', text: `*勤務時間:* ${workHours}` },
          ...(projectName ? [{ type: 'mrkdwn' as const, text: `*PJ:* ${projectName}` }] : []),
        ],
      },
    ],
  }
}

/**
 * 打刻漏れアラート
 * staffEntries: { name, startTime, endTime } の配列。シフト時刻を併記する。
 */
export function buildMissingClockNotification(
  staffEntries: Array<{ name: string; startTime?: string | null; endTime?: string | null }>,
  date: string,
): SlackMessage {
  // HH:MM:SS -> HH:MM に短縮
  const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '--:--')
  const lines = staffEntries.map((e) => {
    const range = `${hhmm(e.startTime)}〜${hhmm(e.endTime)}`
    return `• *${e.name}* (シフト ${range})`
  })
  return {
    text: `【打刻漏れ】${date} - ${staffEntries.length}名が未打刻です`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `⚠️ 打刻漏れ検知 (${date})`, emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `シフト登録済みですが打刻がないメンバー:\n${lines.join('\n')}`,
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
  const now = new Date()
  const dateStr = now.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' })
  const timeStr = time || now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
  return {
    text: `${staffName}さんが休憩に入りました (${dateStr} ${timeStr})`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:coffee: *${staffName}* さんが休憩に入りました (${dateStr} ${timeStr})`,
        },
      },
    ],
  }
}

/**
 * 休憩終了通知
 */
export function buildBreakEndNotification(staffName: string, breakMinutes: number, time?: string): SlackMessage {
  const now = new Date()
  const dateStr = now.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' })
  const timeStr = time || now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
  return {
    text: `${staffName}さんが休憩から戻りました (${dateStr} ${timeStr}, 休憩${breakMinutes}分)`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:arrow_forward: *${staffName}* さんが休憩から戻りました (${dateStr} ${timeStr}, 休憩${breakMinutes}分)`,
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
 * メンバーアサイン通知（単体）
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
 * メンバーアサイン解除通知
 */
export function buildMemberRemovedNotification(staffName: string, projectName: string): SlackMessage {
  return {
    text: `${staffName}さんが${projectName}からアサイン解除されました`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:door: *${staffName}* さんが *${projectName}* からアサイン解除されました`,
        },
      },
    ],
  }
}

/**
 * メンバー一括アサイン通知（複数名を1メッセージに集約）
 */
export function buildBulkMemberAssignedNotification(staffNames: string[], projectName: string, role?: string): SlackMessage {
  if (staffNames.length === 1) {
    return buildMemberAssignedNotification(staffNames[0], projectName, role)
  }
  const nameList = staffNames.map(n => `• ${n}`).join('\n')
  return {
    text: `${staffNames.length}名が${projectName}にアサインされました`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:wave: *${staffNames.length}名* が *${projectName}* にアサインされました${role ? ` (${role})` : ''}\n\n${nameList}`,
        },
      },
    ],
  }
}

/**
 * 汎用アラート通知
 */
/**
 * Slack DMを送信（conversations.open + chat.postMessage）
 * スタッフのSlack User IDを使ってDMチャンネルを開き、メッセージを送信
 */
export async function sendSlackDM(
  slackUserId: string,
  message: SlackMessage
): Promise<{ success: boolean; error?: string; ts?: string }> {
  const token = await getBotTokenSafe()
  if (!token) {
    console.warn('SLACK_BOT_TOKEN is not configured, cannot send DM')
    return { success: false, error: 'SLACK_BOT_TOKEN is not configured' }
  }

  try {
    // DMチャンネルを開く
    const openRes = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ users: slackUserId }),
    })
    const openData = await openRes.json()
    if (!openData.ok) {
      console.error('Slack conversations.open error:', openData.error)
      return { success: false, error: `DM open failed: ${openData.error}` }
    }

    const dmChannelId = openData.channel?.id
    if (!dmChannelId) {
      return { success: false, error: 'DM channel ID not returned' }
    }

    // DMチャンネルにメッセージ送信
    return sendSlackBotMessage(dmChannelId, message)
  } catch (err) {
    console.error('Slack DM send error:', err)
    return { success: false, error: (err as Error).message }
  }
}

/**
 * スタッフのSlack User IDを取得（custom_fieldsから or メールで検索）
 */
export async function resolveStaffSlackUserId(
  staffId: string
): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: staff } = await supabase
    .from('staff')
    .select('id, email, custom_fields')
    .eq('id', staffId)
    .single()

  if (!staff) return null

  const cf = (staff.custom_fields as Record<string, unknown>) || {}
  let slackId = cf.slack_user_id as string | undefined

  if (!slackId && staff.email) {
    const lookup = await lookupSlackUserByEmail(staff.email)
    if (lookup.slackUserId) {
      slackId = lookup.slackUserId
      // キャッシュ保存
      const updatedCf = { ...cf, slack_user_id: slackId }
      await supabase
        .from('staff')
        .update({ custom_fields: updatedCf })
        .eq('id', staff.id)
    }
  }

  return slackId || null
}

/**
 * 退勤漏れDM通知
 */
export function buildClockOutMissingDMNotification(staffName: string, date: string, projectName?: string): SlackMessage {
  const projectText = projectName ? ` (${projectName})` : ''
  return {
    text: `【退勤未打刻】${staffName}さん、${date}${projectText}の退勤打刻がされていません`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:bell: *退勤未打刻のお知らせ*\n${staffName}さん、${date}${projectText}の退勤打刻がまだされていません。\n打刻漏れの場合はポータルから修正をお願いします。`,
        },
      },
    ],
  }
}

/**
 * シフトvs打刻の乖離通知
 */
export function buildShiftAttendanceDiffNotification(
  entries: {
    staffName: string
    shiftTime: string
    actualTime: string
    diffMinutes: number
    attendanceRecordId: string | null
    shiftId: string | null
    staffSlackUserId: string | null
  }[],
  date: string,
  projectName?: string
): SlackMessage {
  const projectText = projectName ? ` — ${projectName}` : ''
  // Button value encoding: `${attendanceRecordId}|${shiftId||''}|${staffSlackUserId||''}`
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `⏱ シフトvs打刻の乖離 (${date}${projectText})`, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `以下のメンバーのシフト時刻と実績に乖離があります (${entries.length}件):`,
      },
    },
  ]

  for (const e of entries) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `• *${e.staffName}*: シフト ${e.shiftTime} → 実績 ${e.actualTime} (差 ${e.diffMinutes}分)`,
      },
    })
    if (e.attendanceRecordId) {
      const value = `${e.attendanceRecordId}|${e.shiftId || ''}|${e.staffSlackUserId || ''}`
      blocks.push({
        type: 'actions',
        block_id: `diff_actions_${e.attendanceRecordId}`,
        elements: [
          {
            type: 'button',
            style: 'primary',
            text: { type: 'plain_text', text: '定時で丸める' },
            action_id: 'diff_round',
            value,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '修正依頼する' },
            action_id: 'diff_request_fix',
            value,
          },
        ],
      } as unknown as SlackBlock)
    }
  }

  return {
    text: `【シフト乖離】${date}${projectText} - ${entries.length}件の乖離を検知`,
    blocks,
  }
}

/**
 * 日報未提出DMリマインダー
 */
export function buildReportReminderDMNotification(staffName: string, date: string): SlackMessage {
  return {
    text: `【日報リマインド】${staffName}さん、${date}の日報がまだ提出されていません`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:memo: *日報リマインド*\n${staffName}さん、本日(${date})の勤務日報がまだ提出されていません。\nお手すきの際にポータルから提出をお願いします。`,
        },
      },
    ],
  }
}

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

// ============================================================
// Usergroup (グループメンション) 自動管理
// project_usergroups テーブル + project_assignments ベースで同期
// ============================================================

/**
 * プロジェクトコード/名前からSlackユーザーグループ用の有効なハンドルを生成
 * Slack制約: 小文字英数字・ハイフンのみ、最大21文字
 */
function sanitizeUsergroupHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // 英数字・ハイフン以外をハイフンに変換
    .replace(/-{2,}/g, '-')       // 連続ハイフンを1つに
    .replace(/^-|-$/g, '')        // 先頭・末尾のハイフンを除去
    .slice(0, 21)                 // Slack上限21文字に切り詰め
    .replace(/-$/g, '')           // 切り詰め後の末尾ハイフンも除去
}

/**
 * プロジェクトのアサインメンバーのSlack User IDリストを取得
 * staff.custom_fields.slack_user_id を使用、なければメールで検索してキャッシュ
 */
async function getProjectAssignmentSlackUserIds(projectId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data: assignments } = await supabase
    .from('project_assignments')
    .select('staff_id, staff:staff_id(id, email, custom_fields)')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .in('status', ['proposed', 'confirmed', 'in_progress'])

  if (!assignments || assignments.length === 0) return []

  const slackUserIds: string[] = []
  for (const assignment of assignments) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const staff = (assignment as any).staff
    if (!staff) continue

    const cf = (staff.custom_fields as Record<string, unknown>) || {}
    let slackId = cf.slack_user_id as string | undefined

    if (!slackId && staff.email) {
      const lookup = await lookupSlackUserByEmail(staff.email)
      if (lookup.slackUserId) {
        slackId = lookup.slackUserId
        // キャッシュ保存
        const updatedCf = { ...cf, slack_user_id: slackId }
        await supabase
          .from('staff')
          .update({ custom_fields: updatedCf })
          .eq('id', staff.id)
      }
    }

    if (slackId) slackUserIds.push(slackId)
  }

  return slackUserIds
}

/**
 * project_usergroups テーブルからユーザーグループIDを取得
 */
async function getProjectUsergroupId(projectId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('project_usergroups')
    .select('usergroup_id')
    .eq('project_id', projectId)
    .maybeSingle()
  return data?.usergroup_id || null
}

/**
 * project_usergroups テーブルにマッピングを保存 (upsert)
 */
async function upsertProjectUsergroup(projectId: string, usergroupId: string, handle: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('project_usergroups')
    .upsert({
      project_id: projectId,
      usergroup_id: usergroupId,
      usergroup_handle: handle,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id' })
}

/**
 * プロジェクト情報からユーザーグループを作成 or 既存を取得
 * handle は project_code ベース、display name は project name
 * 結果は project_usergroups テーブルに保存
 */
async function createOrFindProjectUsergroup(
  projectId: string,
  projectCode: string,
  projectName: string,
  channelId: string | null
): Promise<string | null> {
  const token = getUsergroupToken()
  if (!token) {
    throw new Error('SLACK_USER_TOKEN / SLACK_BOT_TOKEN is not set')
  }

  // project_usergroups テーブルにキャッシュ済みならそれを返す
  const cachedId = await getProjectUsergroupId(projectId)
  if (cachedId) {
    console.log(`[usergroup] Cache hit: projectId=${projectId} → usergroupId=${cachedId}`)
    return cachedId
  }

  const handle = sanitizeUsergroupHandle(projectCode)
  if (!handle) {
    throw new Error(`Could not derive valid handle from project_code: ${projectCode}`)
  }
  console.log(`[usergroup] projectCode="${projectCode}" → handle="${handle}", name="${projectName}"`)

  // Slack API で既存ユーザーグループを検索
  const listRes = await fetch('https://slack.com/api/usergroups.list?include_disabled=true', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const listData = await listRes.json()
  if (!listData.ok) {
    throw new Error(`usergroups.list failed: ${listData.error}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (listData.usergroups || []).find((ug: any) => ug.handle === handle)
  if (existing) {
    console.log(`[usergroup] Found existing usergroup: id=${existing.id}, handle=${existing.handle}, date_delete=${existing.date_delete}`)
    // 無効化されている場合は再有効化
    if (existing.date_delete > 0) {
      const enableRes = await fetch('https://slack.com/api/usergroups.enable', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ usergroup: existing.id }),
      })
      const enableData = await enableRes.json()
      if (!enableData.ok) {
        console.error('[usergroup] usergroups.enable failed:', enableData.error)
        // enable失敗は致命的ではないので続行
      }
    }
    // プロジェクト名で表示名を更新
    const updatePayload: Record<string, string> = {
      usergroup: existing.id,
      name: projectName,
      handle,
    }
    if (channelId) updatePayload.channels = channelId
    const updateRes = await fetch('https://slack.com/api/usergroups.update', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    })
    const updateData = await updateRes.json()
    if (!updateData.ok) {
      console.error('[usergroup] usergroups.update failed:', updateData.error)
      // update失敗でもupsertは実行する
    }
    // project_usergroups テーブルに保存
    await upsertProjectUsergroup(projectId, existing.id, handle)
    return existing.id
  }

  // 新規作成
  console.log(`[usergroup] Creating new usergroup: handle="${handle}", name="${projectName}", channelId=${channelId}`)
  const createPayload: Record<string, string> = {
    name: projectName,
    handle,
    description: `Canvi Portal: ${projectName}`,
  }
  if (channelId) createPayload.channels = channelId
  const createRes = await fetch('https://slack.com/api/usergroups.create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(createPayload),
  })
  const createData = await createRes.json()
  if (!createData.ok) {
    throw new Error(`usergroups.create failed: ${createData.error} (handle="${handle}")`)
  }

  const usergroupId = createData.usergroup.id
  console.log(`[usergroup] Created usergroup ${usergroupId} with handle @${handle}`)
  // project_usergroups テーブルに保存
  await upsertProjectUsergroup(projectId, usergroupId, handle)

  return usergroupId
}

/**
 * ユーザーグループのメンバーをまるごと同期（置換）
 * Slack API の制約: 最低1名のメンバーが必要
 */
async function syncUsergroupMembers(usergroupId: string, userIds: string[]): Promise<void> {
  const token = getUsergroupToken()
  if (!token) {
    throw new Error('SLACK_USER_TOKEN / SLACK_BOT_TOKEN is not set')
  }
  if (userIds.length === 0) {
    console.warn('[usergroup] syncUsergroupMembers: empty user list, skipping')
    return
  }

  console.log(`[usergroup] syncUsergroupMembers: usergroupId=${usergroupId}, users=${userIds.join(',')}`)
  const res = await fetch('https://slack.com/api/usergroups.users.update', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ usergroup: usergroupId, users: userIds.join(',') }),
  })
  const data = await res.json()
  if (!data.ok) {
    throw new Error(`usergroups.users.update failed: ${data.error} (usergroupId=${usergroupId})`)
  }
  console.log(`[usergroup] syncUsergroupMembers: success, ${userIds.length} members set`)
}

/**
 * プロジェクトのユーザーグループを完全同期
 * プロジェクト情報取得 → アサインメンバー取得 → ユーザーグループ作成/更新 → メンバー同期
 * project_usergroups テーブルでマッピングを管理
 */
export async function syncProjectUsergroup(projectId: string): Promise<void> {
  const supabase = createAdminClient()
  console.log(`[usergroup] syncProjectUsergroup START projectId=${projectId}`)

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, project_code, slack_channel_id, custom_fields')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    const msg = `Project not found: ${projectId} (${projectError?.message || 'no data'})`
    console.error('[usergroup]', msg)
    throw new Error(msg)
  }

  console.log(`[usergroup] Project: ${project.project_code} "${project.name}" channel=${project.slack_channel_id}`)

  const displayName = (project.custom_fields as Record<string, unknown>)?.calendar_display_name as string || project.name
  const usergroupId = await createOrFindProjectUsergroup(
    project.id,
    project.project_code,
    displayName,
    project.slack_channel_id
  )
  if (!usergroupId) {
    const msg = `Failed to create/find usergroup for project ${project.project_code} — Slack API may have returned an error (check logs above)`
    console.error('[usergroup]', msg)
    throw new Error(msg)
  }

  console.log(`[usergroup] usergroupId=${usergroupId} for ${project.project_code}`)

  const slackUserIds = await getProjectAssignmentSlackUserIds(projectId)
  console.log(`[usergroup] Found ${slackUserIds.length} Slack user IDs for ${project.project_code}:`, slackUserIds)

  if (slackUserIds.length > 0) {
    await syncUsergroupMembers(usergroupId, slackUserIds)
    console.log(`[usergroup] Synced ${slackUserIds.length} members to usergroup for project ${project.project_code}`)
  } else {
    // Slack はメンバー0人のユーザーグループをオートコンプリートに表示しない
    // Bot自身を仮メンバーとして追加してグループを可視化する
    console.warn('[usergroup] No assigned staff with Slack IDs for project', project.project_code, '— adding bot as placeholder')
    const authRes = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${await getBotTokenSafe()}` },
    })
    const authData = await authRes.json()
    if (authData.ok && authData.user_id) {
      await syncUsergroupMembers(usergroupId, [authData.user_id])
    }
  }
  console.log(`[usergroup] syncProjectUsergroup DONE ${project.project_code}`)
}

/**
 * プロジェクトのユーザーグループを無効化（PJステータスが ended になった時に呼ぶ）
 */
export async function disableProjectUsergroup(projectId: string): Promise<void> {
  const token = getUsergroupToken()
  if (!token) return

  const usergroupId = await getProjectUsergroupId(projectId)
  if (!usergroupId) {
    console.log(`[usergroup] disableProjectUsergroup: no usergroup found for projectId=${projectId}`)
    return
  }

  console.log(`[usergroup] Disabling usergroup ${usergroupId} for projectId=${projectId}`)
  const res = await fetch('https://slack.com/api/usergroups.disable', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ usergroup: usergroupId }),
  })
  const data = await res.json()
  if (!data.ok) {
    console.error(`[usergroup] usergroups.disable failed: ${data.error} (usergroupId=${usergroupId})`)
    throw new Error(`usergroups.disable failed: ${data.error}`)
  }
  console.log(`[usergroup] Disabled usergroup ${usergroupId}`)
}

/**
 * プロジェクトのユーザーグループ名を更新（PJ名変更時に呼ぶ）
 */
export async function updateProjectUsergroupName(projectId: string, newName: string): Promise<void> {
  const token = getUsergroupToken()
  if (!token) return

  const usergroupId = await getProjectUsergroupId(projectId)
  if (!usergroupId) {
    console.log(`[usergroup] updateProjectUsergroupName: no usergroup found for projectId=${projectId}`)
    return
  }

  console.log(`[usergroup] Updating usergroup ${usergroupId} name to "${newName}"`)
  const res = await fetch('https://slack.com/api/usergroups.update', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ usergroup: usergroupId, name: newName, description: `Canvi Portal: ${newName}` }),
  })
  const data = await res.json()
  if (!data.ok) {
    console.error(`[usergroup] usergroups.update failed: ${data.error} (usergroupId=${usergroupId})`)
    throw new Error(`usergroups.update failed: ${data.error}`)
  }
  console.log(`[usergroup] Updated usergroup ${usergroupId} name to "${newName}"`)
}

/**
 * スタッフをプロジェクトのユーザーグループに追加（アサイン時に呼ぶ）
 * ユーザーグループが未作成の場合はフル同期を行う
 */
export async function onProjectAssignmentAdded(projectId: string, staffSlackUserId: string): Promise<void> {
  const token = getUsergroupToken()
  if (!token || !staffSlackUserId) return

  try {
    const usergroupId = await getProjectUsergroupId(projectId)

    if (!usergroupId) {
      // ユーザーグループ未作成 → フル同期で作成
      await syncProjectUsergroup(projectId)
      return
    }

    // 現在のメンバーを取得して追加
    const listRes = await fetch(`https://slack.com/api/usergroups.users.list?usergroup=${usergroupId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const listData = await listRes.json()
    const currentUsers: string[] = listData.ok ? (listData.users || []) : []

    if (currentUsers.includes(staffSlackUserId)) return // 既に所属

    const updatedUsers = [...currentUsers, staffSlackUserId]
    await syncUsergroupMembers(usergroupId, updatedUsers)
    console.log(`[usergroup] Added ${staffSlackUserId} to project usergroup ${usergroupId}`)
  } catch (err) {
    console.error('[usergroup] onProjectAssignmentAdded error:', err)
  }
}

/**
 * スタッフをプロジェクトのユーザーグループから削除（アサイン解除時に呼ぶ）
 * 最低1名必要なため、最後の1名は削除できない
 */
export async function onProjectAssignmentRemoved(projectId: string, staffSlackUserId: string): Promise<void> {
  const token = getUsergroupToken()
  if (!token || !staffSlackUserId) return

  try {
    const usergroupId = await getProjectUsergroupId(projectId)
    if (!usergroupId) return

    const listRes = await fetch(`https://slack.com/api/usergroups.users.list?usergroup=${usergroupId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const listData = await listRes.json()
    const currentUsers: string[] = listData.ok ? (listData.users || []) : []

    const updatedUsers = currentUsers.filter((u) => u !== staffSlackUserId)
    if (updatedUsers.length === 0) {
      console.warn('[usergroup] Cannot remove last member from usergroup', usergroupId)
      return
    }

    await syncUsergroupMembers(usergroupId, updatedUsers)
    console.log(`[usergroup] Removed ${staffSlackUserId} from project usergroup ${usergroupId}`)
  } catch (err) {
    console.error('[usergroup] onProjectAssignmentRemoved error:', err)
  }
}

// Backward-compatible aliases for existing call sites
export const addStaffToProjectUsergroup = onProjectAssignmentAdded
export const removeStaffFromProjectUsergroup = onProjectAssignmentRemoved

/**
 * チャンネルIDからプロジェクトを検索
 */
export async function findProjectByChannelId(channelId: string): Promise<{ id: string } | null> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('projects')
      .select('id')
      .eq('slack_channel_id', channelId)
      .single()
    return data || null
  } catch {
    return null
  }
}

/**
 * チャンネル情報を取得（チャンネル名の解決用）
 */
export async function getChannelInfo(channelId: string): Promise<{ name: string } | null> {
  const token = await getBotTokenSafe()
  if (!token) return null

  try {
    const res = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!data.ok) {
      console.error('[usergroup] conversations.info failed:', data.error)
      return null
    }
    return { name: data.channel.name }
  } catch (err) {
    console.error('[usergroup] getChannelInfo error:', err)
    return null
  }
}

/**
 * Bot参加時の初期同期: チャンネルに紐付くプロジェクトがあればユーザーグループを同期
 */
export async function initUsergroupSync(channelId: string): Promise<void> {
  try {
    const project = await findProjectByChannelId(channelId)
    if (!project) {
      console.log('[usergroup] initUsergroupSync: no project linked to channel', channelId)
      return
    }
    await syncProjectUsergroup(project.id)
  } catch (err) {
    console.error('[usergroup] initUsergroupSync error:', err)
  }
}
