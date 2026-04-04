import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { lookupSlackUserByEmail } from '@/lib/integrations/slack'

/**
 * POST /api/slack/sync-users
 * 全スタッフのSlack User IDを一括で取得してDBに永続化する
 * 管理者のみ実行可能
 */
export async function POST() {
  try {
    const admin = await requireAdmin().catch(() => null)
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const supabase = await createServerSupabaseClient()

    // slack_user_id未設定のアクティブスタッフを取得
    const { data: staffList, error } = await supabase
      .from('staff')
      .select('id, email, custom_fields')
      .in('status', ['active', 'onboarding'])
      .is('deleted_at', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const results = {
      total: 0,
      synced: 0,
      already_linked: 0,
      not_found: 0,
      errors: [] as string[],
    }

    for (const staff of staffList || []) {
      results.total++

      const cf = (staff.custom_fields as Record<string, unknown>) || {}

      // 既にslack_user_idがある場合はスキップ
      if (cf.slack_user_id && typeof cf.slack_user_id === 'string') {
        results.already_linked++
        continue
      }

      if (!staff.email) {
        results.errors.push(`${staff.id}: メールアドレスが未設定`)
        continue
      }

      // Slack APIで検索
      const lookup = await lookupSlackUserByEmail(staff.email)

      if (!lookup.slackUserId) {
        results.not_found++
        continue
      }

      // DBに保存
      const updatedCf = { ...cf, slack_user_id: lookup.slackUserId }
      const { error: updateError } = await supabase
        .from('staff')
        .update({ custom_fields: updatedCf })
        .eq('id', staff.id)

      if (updateError) {
        results.errors.push(`${staff.email}: ${updateError.message}`)
      } else {
        results.synced++
      }

      // Slack APIレート制限対策（Tier 2: 20+ per minute）
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('POST /api/slack/sync-users error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
