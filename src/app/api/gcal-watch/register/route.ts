/**
 * POST /api/gcal-watch/register
 *
 * ログインユーザー自身の Google Calendar primary に対して events.watch を登録し、
 * gcal_watch_channels に保存する。既存チャンネルがあれば stop してから再登録。
 *
 * onboarding 時・/shifts 画面初回表示時に呼ぶことを想定。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'

export async function POST(_request: NextRequest) {
  void _request
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const token = await getValidTokenForUser(user.id)
    if (!token) {
      return NextResponse.json({ error: 'Googleカレンダー未連携' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: staffRecord } = await admin
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    const client = new GoogleCalendarClient(token.accessToken, token.refreshToken || undefined)

    // 既存チャンネルがあれば停止
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from('gcal_watch_channels')
      .select('id, channel_id, resource_id')
      .eq('user_id', user.id) as { data: Array<{ id: string; channel_id: string; resource_id: string }> | null }

    if (existing && existing.length > 0) {
      for (const ch of existing) {
        try {
          await client.stopWatchChannel(ch.channel_id, ch.resource_id)
        } catch {
          // 既に失効している等は無視
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from('gcal_watch_channels').delete().eq('id', ch.id)
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? (process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`)
      : 'http://localhost:3000'
    const webhookUrl = `${baseUrl}/api/webhooks/google-calendar`
    const channelId = `canvi-gcal-${user.id}`

    const watchResult = await client.watchCalendar('primary', webhookUrl, channelId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('gcal_watch_channels').insert({
      user_id: user.id,
      staff_id: staffRecord?.id || null,
      channel_id: channelId,
      resource_id: watchResult.resourceId,
      calendar_id: 'primary',
      expiration: new Date(parseInt(watchResult.expiration, 10)).toISOString(),
    })

    return NextResponse.json({
      channelId,
      resourceId: watchResult.resourceId,
      expiration: watchResult.expiration,
    })
  } catch (error) {
    console.error('POST /api/gcal-watch/register error:', error)
    const message = error instanceof Error ? error.message : 'サーバーエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
