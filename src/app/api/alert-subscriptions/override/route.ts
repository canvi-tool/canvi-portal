import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'

/**
 * PUT /api/alert-subscriptions/override
 * ユーザー単位の上書き(role_override JSONB)を更新する。
 * オーナー専用。
 */

const overrideFlagsSchema = z
  .object({
    enabled: z.boolean().optional(),
    channel_dashboard: z.boolean().optional(),
    channel_slack: z.boolean().optional(),
    channel_email: z.boolean().optional(),
  })
  .partial()

const bodySchema = z.object({
  alert_id: z.string().min(1),
  role: z.enum(['owner', 'admin', 'staff']),
  user_id: z.string().uuid(),
  override: overrideFlagsSchema,
})

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
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    // 対象行を取得
    const cur = await admin
      .from('alert_subscriptions')
      .select('id, role_override')
      .eq('alert_id', parsed.data.alert_id)
      .eq('role', parsed.data.role)
      .maybeSingle()

    if (cur.error) {
      return NextResponse.json({ error: cur.error.message }, { status: 500 })
    }
    if (!cur.data) {
      return NextResponse.json(
        { error: '対象の購読行が存在しません' },
        { status: 404 }
      )
    }

    const merged = {
      ...((cur.data.role_override as Record<string, unknown>) || {}),
      [parsed.data.user_id]: parsed.data.override,
    }

    const upd = await admin
      .from('alert_subscriptions')
      .update({
        role_override: merged,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cur.data.id)

    if (upd.error) {
      return NextResponse.json({ error: upd.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PUT /api/alert-subscriptions/override error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/alert-subscriptions/override?alert_id=&role=&user_id=
 * 指定ユーザーの上書きを解除する。
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (!isOwner(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const url = new URL(request.url)
    const alertId = url.searchParams.get('alert_id') || ''
    const role = url.searchParams.get('role') || ''
    const userId = url.searchParams.get('user_id') || ''

    const parsed = z
      .object({
        alert_id: z.string().min(1),
        role: z.enum(['owner', 'admin', 'staff']),
        user_id: z.string().uuid(),
      })
      .safeParse({ alert_id: alertId, role, user_id: userId })
    if (!parsed.success) {
      return NextResponse.json({ error: 'パラメータ不正' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    const cur = await admin
      .from('alert_subscriptions')
      .select('id, role_override')
      .eq('alert_id', parsed.data.alert_id)
      .eq('role', parsed.data.role)
      .maybeSingle()

    if (cur.error) {
      return NextResponse.json({ error: cur.error.message }, { status: 500 })
    }
    if (!cur.data) {
      return NextResponse.json({ success: true })
    }

    const next = { ...((cur.data.role_override as Record<string, unknown>) || {}) }
    delete next[parsed.data.user_id]

    const upd = await admin
      .from('alert_subscriptions')
      .update({
        role_override: next,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cur.data.id)

    if (upd.error) {
      return NextResponse.json({ error: upd.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/alert-subscriptions/override error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
