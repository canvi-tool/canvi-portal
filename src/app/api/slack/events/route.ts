import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createHmac, timingSafeEqual } from 'crypto'
import {
  findUsergroupByChannel,
  addUserToUsergroup,
  removeUserFromUsergroup,
  initUsergroupSync,
  getChannelInfo,
} from '@/lib/integrations/slack'

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
        case 'member_joined_channel': {
          // メンバーがチャンネルに参加 → ユーザーグループに追加
          after(async () => {
            console.log(`[slack/events] member_joined_channel: user=${event.user} channel=${event.channel}`)
            // まずDBからユーザーグループを検索
            const usergroupId = await findUsergroupByChannel(event.channel)
            if (!usergroupId) {
              // ユーザーグループが未作成の場合は初期同期を実行
              // （Botがイベント受信できている = Bot参加済みチャンネル）
              const info = await getChannelInfo(event.channel)
              if (info) {
                await initUsergroupSync(event.channel, info.name)
              }
              return
            }
            await addUserToUsergroup(usergroupId, event.user)
          })
          break
        }

        case 'member_left_channel': {
          // メンバーがチャンネルから退出 → ユーザーグループから削除
          after(async () => {
            console.log(`[slack/events] member_left_channel: user=${event.user} channel=${event.channel}`)
            const usergroupId = await findUsergroupByChannel(event.channel)
            if (!usergroupId) return
            await removeUserFromUsergroup(usergroupId, event.user)
          })
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
