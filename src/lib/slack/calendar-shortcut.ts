/**
 * Slackメッセージショートカット: 「Canviカレンダーに登録」
 *
 * フロー:
 *  1. ユーザーがSlackメッセージの「その他」メニューから起動
 *     (Slack App Manifest: shortcut callback_id = "canvi_calendar_create")
 *  2. 本ファイルの openCanviCalendarModal でメッセージを解析しモーダル表示
 *  3. ユーザーがモーダル送信 → handleCanviCalendarCreate でシフト作成 + Google Meet 発行
 *  4. 元メッセージのスレッドに結果を返信
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { syncShiftToCalendar } from '@/lib/integrations/google-calendar-sync'

const SLACK_API = 'https://slack.com/api'

interface SlackUser { id: string }
interface SlackMessage { ts: string; text?: string; user?: string }
interface SlackChannel { id: string; name?: string }

interface ShortcutPayload {
  trigger_id: string
  user: SlackUser
  message: SlackMessage
  channel: SlackChannel
}

interface ViewSubmissionPayload {
  user: SlackUser
  view: {
    state: { values: Record<string, Record<string, { value?: string; selected_date?: string; selected_time?: string; selected_option?: { value: string }; selected_users?: string[] }>> }
    private_metadata: string
  }
}

// ========== メッセージテキストから時間・日付を推測 ==========

/** "9:30", "09:30", "0930", "9時30分", "9時〜" などから [HH, MM] を抽出 */
function guessTimes(text: string): Array<{ hh: number; mm: number }> {
  const out: Array<{ hh: number; mm: number }> = []
  const patterns = [
    /(\d{1,2})\s*[:：]\s*(\d{2})/g,
    /(\d{1,2})\s*時\s*(\d{1,2})?\s*分?/g,
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(text)) !== null) {
      const hh = parseInt(m[1], 10)
      const mm = parseInt(m[2] || '0', 10)
      if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
        out.push({ hh, mm })
      }
    }
  }
  // 0930 形式（4桁）
  const re4 = /(?<![\d:])(\d{4})(?![\d])/g
  let m4
  while ((m4 = re4.exec(text)) !== null) {
    const hh = parseInt(m4[1].slice(0, 2), 10)
    const mm = parseInt(m4[1].slice(2, 4), 10)
    if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) out.push({ hh, mm })
  }
  return out
}

/** JSTの今日/明日 YYYY-MM-DD */
function jstYmd(offsetDays = 0): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function guessDate(text: string): string {
  if (/明日|あした|あす/.test(text)) return jstYmd(1)
  if (/明後日|あさって/.test(text)) return jstYmd(2)
  if (/今日|本日/.test(text)) return jstYmd(0)
  const m = text.match(/(\d{1,2})\/(\d{1,2})/)
  if (m) {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
    const y = now.getUTCFullYear()
    const mo = parseInt(m[1], 10)
    const d = parseInt(m[2], 10)
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  return jstYmd(0)
}

/** Slackメッセージ内の <@U123> を抽出 */
function extractMentionedSlackUserIds(text: string): string[] {
  const re = /<@([UW][A-Z0-9]+)>/g
  const out = new Set<string>()
  let m
  while ((m = re.exec(text)) !== null) out.add(m[1])
  return Array.from(out)
}

/** Slackユーザー ID → email */
async function slackUserIdToEmail(slackUserId: string, botToken: string): Promise<{ email: string | null; realName: string | null }> {
  try {
    const res = await fetch(`${SLACK_API}/users.info?user=${slackUserId}`, {
      headers: { Authorization: `Bearer ${botToken}` },
    })
    const json = await res.json()
    if (!json.ok) return { email: null, realName: null }
    return {
      email: json.user?.profile?.email || null,
      realName: json.user?.real_name || json.user?.profile?.display_name || null,
    }
  } catch {
    return { email: null, realName: null }
  }
}

// ========== メインエントリ ==========

/** ショートカットを受け取ってモーダルを開く */
export async function openCanviCalendarModal(payload: ShortcutPayload): Promise<void> {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) return

  const text = payload.message?.text || ''
  const times = guessTimes(text)
  const date = guessDate(text)
  const startTime = times[0]
    ? `${String(times[0].hh).padStart(2, '0')}:${String(times[0].mm).padStart(2, '0')}`
    : '10:00'
  const endDefault = (() => {
    const [h, m] = startTime.split(':').map(Number)
    const end = h * 60 + m + 30
    return `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
  })()
  const endTime = times[1]
    ? `${String(times[1].hh).padStart(2, '0')}:${String(times[1].mm).padStart(2, '0')}`
    : endDefault

  // メンションされたSlackユーザー + メッセージ投稿者も招待候補に
  const mentioned = extractMentionedSlackUserIds(text)
  if (payload.message?.user) mentioned.push(payload.message.user)
  const initialUsers = Array.from(new Set([...mentioned, payload.user.id]))

  // タイトルは1行目の最初の30文字（メンション除去）
  const firstLine = text.replace(/<@[UW][A-Z0-9]+>/g, '').split('\n').find((l) => l.trim()) || 'Slack発起の予定'
  const title = firstLine.replace(/\s+/g, ' ').slice(0, 60).trim() || 'Slack発起の予定'

  // ※ trigger_id は3秒で失効するため、ここでは DB を叩かずに最小ビューで views.open する
  //   プロジェクト一覧は views.open 成功後に取得→views.update で差し替え
  const projectSelectOptions: Array<{ text: { type: 'plain_text'; text: string }; value: string }> = []

  const view = {
    type: 'modal',
    callback_id: 'canvi_calendar_create_modal',
    title: { type: 'plain_text', text: 'Canviカレンダーに登録' },
    submit: { type: 'plain_text', text: '登録する' },
    close: { type: 'plain_text', text: 'キャンセル' },
    private_metadata: JSON.stringify({
      channelId: payload.channel.id,
      messageTs: payload.message.ts,
      originalText: text.slice(0, 2000),
    }),
    blocks: [
      {
        type: 'input',
        block_id: 'title_block',
        element: {
          type: 'plain_text_input',
          action_id: 'title_input',
          initial_value: title,
          max_length: 150,
        },
        label: { type: 'plain_text', text: 'タイトル' },
      },
      projectSelectOptions.length > 0
        ? {
            type: 'input',
            block_id: 'project_block',
            element: {
              type: 'static_select',
              action_id: 'project_select',
              options: projectSelectOptions,
              initial_option: projectSelectOptions[0],
            },
            label: { type: 'plain_text', text: 'プロジェクト' },
          }
        : null,
      {
        type: 'input',
        block_id: 'date_block',
        element: { type: 'datepicker', action_id: 'date_select', initial_date: date },
        label: { type: 'plain_text', text: '日付' },
      },
      {
        type: 'input',
        block_id: 'start_time_block',
        element: { type: 'timepicker', action_id: 'start_time', initial_time: startTime },
        label: { type: 'plain_text', text: '開始時刻' },
      },
      {
        type: 'input',
        block_id: 'end_time_block',
        element: { type: 'timepicker', action_id: 'end_time', initial_time: endTime },
        label: { type: 'plain_text', text: '終了時刻' },
      },
      {
        type: 'input',
        block_id: 'attendees_block',
        optional: true,
        element: {
          type: 'multi_users_select',
          action_id: 'attendees_select',
          initial_users: initialUsers,
        },
        label: { type: 'plain_text', text: '招待者（Slackメンバー）' },
      },
      {
        type: 'input',
        block_id: 'notes_block',
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'notes_input',
          multiline: true,
          initial_value: text.slice(0, 1500),
        },
        label: { type: 'plain_text', text: 'メモ / 元メッセージ' },
      },
    ].filter(Boolean),
  }

  const openRes = await fetch(`${SLACK_API}/views.open`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trigger_id: payload.trigger_id, view }),
  })
  const openJson = await openRes.json().catch(() => null) as { ok?: boolean; error?: string; view?: { id?: string }; response_metadata?: unknown } | null
  if (!openJson?.ok) {
    console.error('[canvi_calendar_create] views.open failed', openJson)
    return
  }
  const viewId = openJson.view?.id

  // views.open 成功後に DB からプロジェクト一覧を取得して views.update で差し替え
  // fire-and-forget: 呼び出し側の await を早めに返すために await しない
  void (async () => {
  try {
    const admin = createAdminClient()
    let projectOptions: Array<{ id: string; name: string }> = []
    const { data: all } = await admin.from('projects').select('id, name').is('deleted_at', null).limit(50)
    projectOptions = all || []
    if (projectOptions.length > 0 && viewId) {
      const opts = projectOptions.slice(0, 100).map((p) => ({
        text: { type: 'plain_text', text: p.name.slice(0, 75) },
        value: p.id,
      }))
      const projectBlock = {
        type: 'input',
        block_id: 'project_block',
        element: {
          type: 'static_select',
          action_id: 'project_select',
          options: opts,
          initial_option: opts[0],
        },
        label: { type: 'plain_text', text: 'プロジェクト' },
      }
      // title の直後に project_block を差し込む
      const updatedBlocks = [view.blocks[0], projectBlock, ...view.blocks.slice(1)]
      const updatedView = { ...view, blocks: updatedBlocks }
      const upRes = await fetch(`${SLACK_API}/views.update`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ view_id: viewId, view: updatedView }),
      })
      const upJson = await upRes.json().catch(() => null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(upJson as any)?.ok) console.error('[canvi_calendar_create] views.update failed', upJson)
    }
  } catch (e) {
    console.error('[canvi_calendar_create] project fetch / views.update exception', e)
  }
  })()
}

/** モーダル送信 → シフト作成 + GCal 同期 + 結果をスレッド返信 */
export async function handleCanviCalendarCreate(payload: ViewSubmissionPayload): Promise<void> {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) return

  const values = payload.view.state.values
  const metadata = JSON.parse(payload.view.private_metadata || '{}') as {
    channelId?: string
    messageTs?: string
    originalText?: string
  }

  const title = values.title_block?.title_input?.value?.trim() || 'Slack発起の予定'
  let projectId = values.project_block?.project_select?.selected_option?.value
  const date = values.date_block?.date_select?.selected_date
  const startTime = values.start_time_block?.start_time?.selected_time
  const endTime = values.end_time_block?.end_time?.selected_time
  const slackUserIds = values.attendees_block?.attendees_select?.selected_users || []
  const notes = values.notes_block?.notes_input?.value || metadata.originalText || ''

  const admin = createAdminClient()

  // Slackユーザーを Canvi staff に解決
  const { email: requesterEmail } = await slackUserIdToEmail(payload.user.id, botToken)
  if (!requesterEmail) {
    await postSlackThread(metadata.channelId, metadata.messageTs, ':warning: Slackユーザーのメールアドレスが取得できませんでした')
    return
  }

  const { data: requester } = await admin.from('users').select('id').ilike('email', requesterEmail).maybeSingle()
  if (!requester?.id) {
    await postSlackThread(metadata.channelId, metadata.messageTs, ':warning: Canvi Portalに紐付くユーザーが見つかりません')
    return
  }

  // 作成者の staff_id を解決
  const { data: staff } = await admin
    .from('staff')
    .select('id, last_name, first_name')
    .eq('user_id', requester.id)
    .maybeSingle()
  if (!staff?.id) {
    await postSlackThread(metadata.channelId, metadata.messageTs, ':warning: スタッフ情報が見つかりません')
    return
  }

  // project_block が views.update 前に送信された場合のフォールバック: 任意の1件を選択
  if (!projectId) {
    const { data: fallbackProj } = await admin.from('projects').select('id').is('deleted_at', null).limit(1).maybeSingle()
    if (fallbackProj?.id) projectId = fallbackProj.id
  }

  if (!projectId || !date || !startTime || !endTime) {
    const missing = [
      !projectId && 'プロジェクト',
      !date && '日付',
      !startTime && '開始時刻',
      !endTime && '終了時刻',
    ].filter(Boolean).join('/')
    await postSlackThread(metadata.channelId, metadata.messageTs, `:warning: 必要項目が未入力です (${missing})`)
    return
  }
  if (startTime >= endTime) {
    await postSlackThread(metadata.channelId, metadata.messageTs, ':warning: 終了時刻は開始時刻より後に設定してください')
    return
  }

  // 招待者: Slackユーザー → email → Canvi staff
  // ポリシー:
  //  - 作成者自身も attendees に含める（Canviカレンダー上で招待者として明示表示するため）
  //  - Canvi未登録でもemailが取得できれば attendees に追加し、GCal招待を送る
  const attendees: Array<{ email: string; name?: string; staff_id?: string; external?: boolean }> = []
  const unresolvedSlackIds: string[] = []
  // 作成者自身を先に追加
  attendees.push({
    email: requesterEmail,
    name: `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || undefined,
    staff_id: staff.id,
    external: false,
  })
  for (const sid of slackUserIds) {
    if (sid === payload.user.id) continue // 作成者は既に追加済み
    const { email, realName } = await slackUserIdToEmail(sid, botToken)
    if (!email) {
      unresolvedSlackIds.push(sid)
      continue
    }
    const { data: u } = await admin.from('users').select('id').ilike('email', email).maybeSingle()
    let staffId: string | undefined
    let name: string | undefined = realName || undefined
    let external = true
    if (u?.id) {
      const { data: s } = await admin
        .from('staff')
        .select('id, last_name, first_name, user:users!staff_user_id_fkey(email)')
        .eq('user_id', u.id)
        .maybeSingle()
      if (s?.id) {
        staffId = s.id
        name = `${s.last_name || ''} ${s.first_name || ''}`.trim() || name
        external = false
      }
    }
    attendees.push({ email, name, staff_id: staffId, external })
  }

  // AUTO 承認でシフト登録
  const now = new Date().toISOString()
  const { data: inserted, error: insertError } = await admin
    .from('shifts')
    .insert({
      staff_id: staff.id,
      project_id: projectId,
      shift_date: date,
      start_time: startTime,
      end_time: endTime,
      shift_type: 'WORK',
      title,
      notes,
      attendees,
      status: 'APPROVED',
      submitted_at: now,
      approved_at: now,
      approved_by: requester.id,
      created_by: requester.id,
    } as never)
    .select('id')
    .single()

  if (insertError || !inserted) {
    console.error('[canvi_calendar_create] insert failed:', insertError)
    await postSlackThread(metadata.channelId, metadata.messageTs, `:x: シフト作成に失敗しました: ${insertError?.message || 'unknown'}`)
    return
  }

  // GCal + Meet URL 発行（fire-and-awaited; 結果をメッセージに含めたいため）
  let meetUrl = ''
  try {
    await syncShiftToCalendar(inserted.id)
    const { data: refreshed } = await admin
      .from('shifts')
      .select('google_meet_url')
      .eq('id', inserted.id)
      .maybeSingle()
    meetUrl = (refreshed as { google_meet_url?: string | null } | null)?.google_meet_url || ''
  } catch (e) {
    console.error('[canvi_calendar_create] gcal sync failed:', e)
  }

  const dateJP = (() => {
    const [y, mo, d] = date.split('-').map(Number)
    const dt = new Date(y, mo - 1, d)
    const wd = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()]
    return `${mo}/${d}(${wd})`
  })()

  const canviLinked = attendees.filter((a) => !a.external)
  const externalOnly = attendees.filter((a) => a.external)
  const lines = [
    `:white_check_mark: *Canviカレンダーに登録しました*`,
    `*${title}*`,
    `${dateJP} ${startTime} 〜 ${endTime}`,
    canviLinked.length > 0
      ? `Canvi連携済み招待: ${canviLinked.map((a) => a.name || a.email).join(', ')}`
      : '',
    externalOnly.length > 0
      ? `外部Google招待: ${externalOnly.map((a) => a.name || a.email).join(', ')}`
      : '',
    attendees.length > 0 ? `:calendar: Googleカレンダー招待メールを送信しました` : '',
    unresolvedSlackIds.length > 0
      ? `:warning: Email未取得のSlackユーザー: ${unresolvedSlackIds.map((id) => `<@${id}>`).join(', ')} (users:read.email スコープ未付与の可能性)`
      : '',
    meetUrl ? `Google Meet: ${meetUrl}` : '',
  ].filter(Boolean)

  await postSlackThread(metadata.channelId, metadata.messageTs, lines.join('\n'))
}

async function postSlackThread(channelId: string | undefined, threadTs: string | undefined, text: string): Promise<void> {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken || !channelId) return
  try {
    await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel: channelId,
        thread_ts: threadTs,
        text,
      }),
    })
  } catch (e) {
    console.error('[postSlackThread] failed:', e)
  }
}
