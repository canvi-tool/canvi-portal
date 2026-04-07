/**
 * アラート購読ディスパッチャ (Phase 2)
 *
 * 役割:
 *   - alert_subscriptions を参照して、対象アラートをどのチャネル
 *     (in-app / slack / email) でどのロールに配信するか解決する
 *   - role_override JSONB によるユーザー単位の上書きを適用する
 *   - 解決したチャネルに従って通知を送信する
 *
 * 既存挙動を壊さないため、購読が読めなかった場合 / role_override が
 * 未設定の場合は role 既定値にフォールバックする。
 */

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendSlackAlert,
  buildGeneralAlertNotification,
} from '@/lib/integrations/slack'
import { sendEmail } from '@/lib/email/send'

export type AlertRole = 'owner' | 'admin' | 'staff'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface AlertChannelFlags {
  enabled: boolean
  channel_dashboard: boolean
  channel_slack: boolean
  channel_email: boolean
}

export interface AlertSubscriptionRow extends AlertChannelFlags {
  alert_id: string
  role: AlertRole
  role_override: Record<string, Partial<AlertChannelFlags>> | null
}

export interface AlertRecipient {
  userId: string
  role: AlertRole
  email?: string | null
}

export interface DispatchAlertInput {
  alertId: string
  title: string
  message: string
  severity: AlertSeverity
  recipients: AlertRecipient[]
}

export interface DispatchResult {
  alertId: string
  inApp: number
  slack: number
  email: number
  errors: string[]
}

const recipientSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['owner', 'admin', 'staff']),
  email: z.string().email().nullable().optional(),
})

const dispatchInputSchema = z.object({
  alertId: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['info', 'warning', 'critical']),
  recipients: z.array(recipientSchema),
})

const overrideFlagsSchema = z
  .object({
    enabled: z.boolean().optional(),
    channel_dashboard: z.boolean().optional(),
    channel_slack: z.boolean().optional(),
    channel_email: z.boolean().optional(),
  })
  .partial()

/**
 * role + alertId のサブスクリプション行を取得する。
 * 失敗時は null を返す（呼び出し側で「既存挙動維持」できる）
 */
export async function fetchSubscriptionsForAlert(
  alertId: string
): Promise<AlertSubscriptionRow[] | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    const res = await admin
      .from('alert_subscriptions')
      .select(
        'alert_id, role, enabled, channel_dashboard, channel_slack, channel_email, role_override'
      )
      .eq('alert_id', alertId)
    if (res.error) {
      console.error('[alerts/dispatcher] fetchSubscriptionsForAlert error:', res.error)
      return null
    }
    return (res.data || []) as AlertSubscriptionRow[]
  } catch (e) {
    console.error('[alerts/dispatcher] fetchSubscriptionsForAlert thrown:', e)
    return null
  }
}

/**
 * 受信者ごとに有効なチャネルフラグを解決する。
 * - role 既定値を読み込み → role_override[userId] でマージ上書き
 */
export function resolveChannelsForRecipient(
  recipient: AlertRecipient,
  rows: AlertSubscriptionRow[] | null
): AlertChannelFlags {
  const fallback: AlertChannelFlags = {
    enabled: true,
    channel_dashboard: true,
    channel_slack: false,
    channel_email: false,
  }
  if (!rows) return fallback

  const row = rows.find((r) => r.role === recipient.role)
  if (!row) return { ...fallback, enabled: false }

  const base: AlertChannelFlags = {
    enabled: row.enabled,
    channel_dashboard: row.channel_dashboard,
    channel_slack: row.channel_slack,
    channel_email: row.channel_email,
  }

  const override = row.role_override?.[recipient.userId]
  if (!override) return base

  const parsed = overrideFlagsSchema.safeParse(override)
  if (!parsed.success) return base

  return {
    enabled: parsed.data.enabled ?? base.enabled,
    channel_dashboard: parsed.data.channel_dashboard ?? base.channel_dashboard,
    channel_slack: parsed.data.channel_slack ?? base.channel_slack,
    channel_email: parsed.data.channel_email ?? base.channel_email,
  }
}

/**
 * 単一の userId が指定アラートをダッシュボードで購読中か判定する。
 * (既存ダッシュボード集計のドロップイン置換用)
 */
export async function isSubscribedDashboard(
  alertId: string,
  recipient: AlertRecipient
): Promise<boolean> {
  const rows = await fetchSubscriptionsForAlert(alertId)
  if (rows === null) return true // 取得失敗時は既存挙動維持
  const flags = resolveChannelsForRecipient(recipient, rows)
  return flags.enabled && flags.channel_dashboard
}

/**
 * アラートを購読チャネルに従って配信する。
 * - in-app: alerts テーブルへ insert（既存スキーマ準拠）
 * - slack: sendSlackAlert (汎用ビルダー使用)
 * - email: sendEmail (シンプルテキスト)
 */
export async function dispatchAlert(input: DispatchAlertInput): Promise<DispatchResult> {
  const result: DispatchResult = {
    alertId: input.alertId,
    inApp: 0,
    slack: 0,
    email: 0,
    errors: [],
  }

  try {
    const parsed = dispatchInputSchema.safeParse(input)
    if (!parsed.success) {
      result.errors.push(`validation: ${JSON.stringify(parsed.error.flatten())}`)
      return result
    }

    const rows = await fetchSubscriptionsForAlert(input.alertId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    for (const recipient of parsed.data.recipients) {
      const flags = resolveChannelsForRecipient(recipient, rows)
      if (!flags.enabled) continue

      // in-app
      if (flags.channel_dashboard) {
        try {
          const { error } = await admin.from('alerts').insert({
            alert_type: input.alertId,
            message: input.message,
            severity: input.severity,
            status: 'active',
            related_user_id: recipient.userId,
          })
          if (error) {
            result.errors.push(`inApp[${recipient.userId}]: ${error.message}`)
          } else {
            result.inApp += 1
          }
        } catch (e) {
          result.errors.push(`inApp[${recipient.userId}]: ${(e as Error).message}`)
        }
      }

      // slack
      if (flags.channel_slack) {
        try {
          const msg = buildGeneralAlertNotification(
            input.title,
            input.message,
            input.severity
          )
          const r = await sendSlackAlert(msg)
          if (r.success) result.slack += 1
          else result.errors.push(`slack[${recipient.userId}]: ${r.error || 'unknown'}`)
        } catch (e) {
          result.errors.push(`slack[${recipient.userId}]: ${(e as Error).message}`)
        }
      }

      // email
      if (flags.channel_email && recipient.email) {
        try {
          await sendEmail({
            to: recipient.email,
            subject: `[${input.severity.toUpperCase()}] ${input.title}`,
            text: input.message,
            html: `<p>${escapeHtml(input.message)}</p>`,
          })
          result.email += 1
        } catch (e) {
          result.errors.push(`email[${recipient.userId}]: ${(e as Error).message}`)
        }
      }
    }
  } catch (e) {
    console.error('[alerts/dispatcher] dispatchAlert error:', e)
    result.errors.push(`dispatch: ${(e as Error).message}`)
  }
  return result
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
