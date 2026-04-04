import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/rbac'
import {
  lookupSlackUserByEmail,
  inviteUserToSlackWorkspace,
  inviteUserToSlackChannel,
  updateSlackUserProfile,
} from '@/lib/integrations/slack'

/**
 * POST /api/slack/provision
 * Slackアカウントの発行（ワークスペース招待）+ 紐付け + 表示名設定 + チャンネル招待
 *
 * Body: {
 *   staff_id: string
 *   display_name: string
 *   channel_ids?: string[]  // 招待するチャンネルID一覧
 * }
 *
 * 処理フロー:
 * 1. メールアドレスでSlackユーザーを検索
 * 2. 見つからなければワークスペースに招待（User Token必要）
 * 3. Slack表示名を更新
 * 4. 指定チャンネルに招待
 * 5. slack_user_id を staff.custom_fields に保存
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin().catch(() => null)
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const { staff_id, display_name, channel_ids } = body as {
      staff_id: string
      display_name: string
      channel_ids?: string[]
    }

    if (!staff_id || !display_name) {
      return NextResponse.json(
        { error: 'staff_id と display_name は必須です' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // スタッフ情報取得
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, email, last_name, first_name, custom_fields')
      .eq('id', staff_id)
      .single()

    if (staffError || !staff) {
      return NextResponse.json({ error: 'スタッフが見つかりません' }, { status: 404 })
    }

    if (!staff.email) {
      return NextResponse.json({ error: 'メールアドレスが未設定です' }, { status: 400 })
    }

    const cf = (staff.custom_fields as Record<string, unknown>) || {}

    // 既に連携済みの場合
    if (cf.slack_user_id) {
      return NextResponse.json(
        { error: '既にSlack連携済みです', slack_user_id: cf.slack_user_id },
        { status: 409 }
      )
    }

    const results = {
      workspace_invited: false,
      user_found: false,
      profile_updated: false,
      channels_invited: [] as string[],
      channels_failed: [] as { channel_id: string; error: string }[],
      slack_user_id: null as string | null,
      warnings: [] as string[],
    }

    // Step 1: Slackユーザー検索（手動入力されたSlack User IDがあればそちらを使用）
    let slackUserId: string | undefined

    if (body.slack_user_id && typeof body.slack_user_id === 'string') {
      // 手動入力されたSlack User ID
      slackUserId = body.slack_user_id.trim()
      results.user_found = true
    } else {
      const lookup = await lookupSlackUserByEmail(staff.email)

      if (lookup.slackUserId) {
        slackUserId = lookup.slackUserId
        results.user_found = true
      } else {
        // ユーザーが見つからない → ワークスペース招待を試行
        const invite = await inviteUserToSlackWorkspace(staff.email, channel_ids)

        if (!invite.success) {
          // admin スコープがない or 既に参加済みだがメール不一致
          return NextResponse.json(
            {
              error: 'Slackユーザーが見つかりません。' +
                'Slack管理画面からユーザーを招待した後、再度お試しください。' +
                'または「Slack User ID手動入力」をお使いください。',
              error_code: 'user_not_found',
              original_error: invite.error,
              results,
            },
            { status: 400 }
          )
        }

        results.workspace_invited = true

        // 招待後、少し待ってからユーザーID取得を試行
        await new Promise((r) => setTimeout(r, 2000))
        const lookupRetry = await lookupSlackUserByEmail(staff.email)
        slackUserId = lookupRetry.slackUserId

        if (!slackUserId) {
          return NextResponse.json({
            success: true,
            message: 'Slack招待メールを送信しました。ユーザーが招待を承認した後、自動的に連携されます。',
            results,
          })
        }
      }
    }

    results.slack_user_id = slackUserId ?? null

    if (!slackUserId) {
      return NextResponse.json({ error: 'Slack User IDを特定できませんでした' }, { status: 400 })
    }

    // Step 3: 表示名を更新
    const profileResult = await updateSlackUserProfile(slackUserId, display_name)
    results.profile_updated = profileResult.success
    if (!profileResult.success) {
      results.warnings.push(`表示名の更新に失敗: ${profileResult.error}`)
    }

    // Step 4: チャンネルに招待
    if (channel_ids && channel_ids.length > 0) {
      for (const channelId of channel_ids) {
        const inviteResult = await inviteUserToSlackChannel(channelId, slackUserId)
        if (inviteResult.success || inviteResult.alreadyInChannel) {
          results.channels_invited.push(channelId)
        } else {
          results.channels_failed.push({
            channel_id: channelId,
            error: inviteResult.error || '不明なエラー',
          })
        }
        // レート制限対策
        await new Promise((r) => setTimeout(r, 300))
      }
    }

    // Step 5: DB保存
    const updatedCf = {
      ...cf,
      slack_user_id: slackUserId,
      slack_display_name: display_name,
    }
    const { error: updateError } = await supabase
      .from('staff')
      .update({ custom_fields: updatedCf })
      .eq('id', staff.id)

    if (updateError) {
      return NextResponse.json(
        { error: 'DB更新に失敗しました: ' + updateError.message, results },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      slack_user_id: slackUserId,
      display_name,
      results,
    })
  } catch (error) {
    console.error('POST /api/slack/provision error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
