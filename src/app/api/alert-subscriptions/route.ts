import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'

/**
 * アラート購読設定 API（オーナー専用）
 * Phase 1: ダッシュボード配信のみ実効化。Slack/メール列はPhase 2 ON化予定。
 *
 * Note: alert_definitions / alert_subscriptions は Database 型未生成のため、
 *       既存コードと同様 supabase クライアントを any キャストして扱う。
 */

interface AlertDefinitionRow {
  id: string
  category: string
  label: string
  default_severity: 'info' | 'warning' | 'critical'
  action_url_template: string | null
  sort_order: number
}

interface AlertSubscriptionRow {
  id: string
  alert_id: string
  role: 'owner' | 'admin' | 'staff'
  channel_dashboard: boolean
  channel_slack: boolean
  channel_email: boolean
  enabled: boolean
  updated_by: string | null
  updated_at: string
}

/**
 * GET /api/alert-subscriptions
 * アラート種別カタログと購読設定を返す（オーナーのみ）
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (!isOwner(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    const defsRes = await admin
      .from('alert_definitions')
      .select('id, category, label, default_severity, action_url_template, sort_order')
      .order('sort_order', { ascending: true })

    const subsRes = await admin
      .from('alert_subscriptions')
      .select('id, alert_id, role, channel_dashboard, channel_slack, channel_email, enabled, updated_by, updated_at')

    if (defsRes.error) {
      return NextResponse.json({ error: defsRes.error.message }, { status: 500 })
    }
    if (subsRes.error) {
      return NextResponse.json({ error: subsRes.error.message }, { status: 500 })
    }

    return NextResponse.json({
      definitions: (defsRes.data || []) as AlertDefinitionRow[],
      subscriptions: (subsRes.data || []) as AlertSubscriptionRow[],
    })
  } catch (error) {
    console.error('GET /api/alert-subscriptions error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

const putItemSchema = z.object({
  alert_id: z.string().min(1),
  role: z.enum(['owner', 'admin', 'staff']),
  enabled: z.boolean(),
  channel_dashboard: z.boolean(),
  channel_slack: z.boolean(),
  channel_email: z.boolean(),
})

const putBodySchema = z.object({
  items: z.array(putItemSchema).min(1),
})

/**
 * PUT /api/alert-subscriptions
 * 一括 upsert（オーナーのみ）
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (!isOwner(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const json = (await request.json()) as unknown
    const parsed = putBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    const now = new Date().toISOString()

    const rows = parsed.data.items.map((it) => ({
      alert_id: it.alert_id,
      role: it.role,
      enabled: it.enabled,
      channel_dashboard: it.channel_dashboard,
      channel_slack: it.channel_slack,
      channel_email: it.channel_email,
      updated_by: user.id,
      updated_at: now,
    }))

    const { error } = await admin
      .from('alert_subscriptions')
      .upsert(rows, { onConflict: 'alert_id,role' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: rows.length })
  } catch (error) {
    console.error('PUT /api/alert-subscriptions error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
