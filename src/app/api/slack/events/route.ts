import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createHmac, timingSafeEqual } from 'crypto'
import {
  findProjectByChannelId,
  syncProjectUsergroup,
} from '@/lib/integrations/slack'
import { processThreadReply } from '@/lib/slack/thread-reply-processor'

// Vercel上で応答後も処理を継続させる
function after(fn: () => Promise<unknown>) {
  try {
    waitUntil(fn().catch((e) => console.error('[slack/events after] task error:', e)))
  } catch {
    fn().catch((e) => console.error('[slack/events after-fallback] task error:', e))
  }
}

// Slack署名検証
function verifySlackSignature(request: NextRequest, rawBody: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim()
  if (!signingSecret) {
    console.error('[slack/events] SLACK_SIGNING_SECRET is not set')
    return false
  }
  if (process.env.SLACK_SKIP_SIGNATURE_VERIFICATION === 'true') {
    console.warn('[slack/events] signature verification SKIPPED via env flag')
    return true
  }

  const timestamp = request.headers.get('x-slack-request-timestamp')
  const signature = request.headers.get('x-slack-signature')
  if (!timestamp || !signature) return false

  const drift = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10))
  if (drift > 300) return false

  const baseString = `v0:${timestamp}:${rawBody}`
  const computed = `v0=${createHmac('sha256', signingSecret).update(baseString).digest('hex')}`

  try {
    const sigBuf = Buffer.from(signature)
    const cmpBuf = Buffer.from(computed)
    if (sigBuf.length !== cmpBuf.length) return false
    return timingSafeEqual(sigBuf, cmpBuf)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const payload = JSON.parse(rawBody)

    // url_verification チャレンジ（署名検証なしで即応答 — Slack仕様）
    if (payload.type === 'url_verification') {
      return NextResponse.json({ challenge: payload.challenge })
    }

    // 署名検証
    if (!verifySlackSignature(request, rawBody)) {
      console.error('[slack/events] signature verification failed')
      return new Response('Unauthorized', { status: 401 })
    }

    // イベントコールバック処理
    if (payload.type === 'event_callback') {
      const event = payload.event

      switch (event.type) {
        case 'member_joined_channel':
        case 'member_left_channel': {
          // メンバーがチャンネルに参加/退出 → プロジェクト紐付きならアサインベースで再同期
          after(async () => {
            console.log(`[slack/events] ${event.type}: user=${event.user} channel=${event.channel}`)
            const project = await findProjectByChannelId(event.channel)
            if (!project) return
            await syncProjectUsergroup(project.id)
          })
          break
        }

        case 'message': {
          // スレッド返信の検出: thread_ts があり、bot_id がない（人間の返信）
          if (event.thread_ts && !event.bot_id && !event.subtype) {
            after(async () => {
              console.log(`[slack/events] thread reply: channel=${event.channel} thread_ts=${event.thread_ts} user=${event.user}`)
              try {
                const result = await processThreadReply({
                  channelId: event.channel,
                  threadTs: event.thread_ts,
                  messageTs: event.ts,
                  userId: event.user,
                  text: event.text || '',
                })
                if (result.handled) {
                  console.log(`[slack/events] thread reply processed: actions=${result.actions.join(',')}`)
                }
              } catch (err) {
                console.error('[slack/events] thread reply processing error:', err)
              }
            })
          }
          break
        }
      }

      // Slack 3秒ルール: 即200返却
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[slack/events] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
