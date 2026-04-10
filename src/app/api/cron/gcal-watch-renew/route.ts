/**
 * GET /api/cron/gcal-watch-renew
 *
 * 1日1回、24時間以内に expire する gcal_watch_channels を renew する。
 * （Google の events.watch はチャネル毎に最大 7日で期限切れ）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const renewed: Array<{ userId: string; channelId: string; ok: boolean; error?: string }> = []

  // 24時間以内に期限切れになるチャネルを対象
  const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: channels } = await (admin as any)
    .from('gcal_watch_channels')
    .select('id, user_id, staff_id, channel_id, resource_id, calendar_id, expiration')
    .lte('expiration', cutoff) as { data: Array<{ id: string; user_id: string; staff_id: string | null; channel_id: string; resource_id: string; calendar_id: string; expiration: string }> | null }

  if (!channels || channels.length === 0) {
    return NextResponse.json({ renewed: [], message: 'no channels to renew' })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  const webhookUrl = `${baseUrl}/api/webhooks/google-calendar`

  for (const ch of channels) {
    try {
      const token = await getValidTokenForUser(ch.user_id)
      if (!token) {
        renewed.push({ userId: ch.user_id, channelId: ch.channel_id, ok: false, error: 'no_token' })
        continue
      }
      const client = await GoogleCalendarClient.create(token.accessToken, token.refreshToken || undefined)
      // 旧チャンネルを stop
      try {
        await client.stopWatchChannel(ch.channel_id, ch.resource_id)
      } catch {
        // 失効済みなら無視
      }
      const newChannelId = `canvi-gcal-${ch.user_id}`
      const watchResult = await client.watchCalendar(ch.calendar_id || 'primary', webhookUrl, newChannelId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('gcal_watch_channels')
        .update({
          channel_id: newChannelId,
          resource_id: watchResult.resourceId,
          expiration: new Date(parseInt(watchResult.expiration, 10)).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', ch.id)
      renewed.push({ userId: ch.user_id, channelId: newChannelId, ok: true })
    } catch (e) {
      renewed.push({
        userId: ch.user_id,
        channelId: ch.channel_id,
        ok: false,
        error: e instanceof Error ? e.message : 'unknown',
      })
    }
  }

  return NextResponse.json({ renewed, count: renewed.length })
}
