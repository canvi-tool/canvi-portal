import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendSlackBotMessage,
  resolveStaffSlackUserId,
} from '@/lib/integrations/slack'

/**
 * Slack スレッド返信プロセッサ
 *
 * ボットが送信したメッセージのスレッドに返信があった場合、
 * 返信内容を解析してポータルのデータを自動更新する。
 *
 * 対応するメッセージタイプ:
 * - alert_summary: AIアラート通知 → アラート解決/無視ルール作成
 * - clock_in/clock_out: 出退勤通知 → 打刻修正
 * - report_submitted: 日報提出通知 → 承認/差戻し
 * - shift_submitted: シフト提出通知 → 承認/却下
 */

interface ThreadReplyEvent {
  channelId: string
  threadTs: string   // Parent message ts
  messageTs: string  // This reply's ts
  userId: string     // Slack user ID of replier
  text: string       // Reply text content
}

interface ProcessResult {
  handled: boolean
  actions: string[]
  error?: string
}

// ========================================
// メイン処理
// ========================================

export async function processThreadReply(event: ThreadReplyEvent): Promise<ProcessResult> {
  const admin = createAdminClient()
  const result: ProcessResult = { handled: false, actions: [] }

  try {
    // 1. このスレッドの親メッセージを slack_bot_messages から検索
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: botMessage } = await (admin as any)
      .from('slack_bot_messages')
      .select('*')
      .eq('channel_id', event.channelId)
      .eq('message_ts', event.threadTs)
      .single()

    if (!botMessage) {
      // ボットのメッセージではないスレッドへの返信 → スキップ
      return result
    }

    // 2. メッセージタイプに応じて処理を分岐
    switch (botMessage.message_type) {
      case 'alert_summary':
        return await handleAlertSummaryReply(event, botMessage, admin)
      case 'clock_in':
      case 'clock_out':
        return await handleAttendanceReply(event, botMessage, admin)
      case 'report_submitted':
        return await handleReportReply(event, botMessage, admin)
      case 'shift_submitted':
        return await handleShiftReply(event, botMessage, admin)
      default:
        console.log(`[thread-reply] Unknown message type: ${botMessage.message_type}`)
        return result
    }
  } catch (error) {
    console.error('[thread-reply] Processing error:', error)
    return { handled: false, actions: [], error: (error as Error).message }
  }
}

// ========================================
// アラートサマリーへの返信処理
// ========================================

async function handleAlertSummaryReply(
  event: ThreadReplyEvent,
  botMessage: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any
): Promise<ProcessResult> {
  const result: ProcessResult = { handled: true, actions: [] }
  const text = event.text.trim()
  const context = botMessage.context as {
    alerts?: Array<{
      id: string
      type: string
      staffId: string | null
      staffName: string
      projectId: string | null
      date: string
      description: string
    }>
    projectId?: string
    date?: string
  }

  if (!context?.alerts || context.alerts.length === 0) {
    return { handled: false, actions: [] }
  }

  // 意図解析
  const intent = parseAlertReplyIntent(text, context.alerts)

  if (!intent) {
    // 意図が分からない場合はヘルプメッセージ
    await sendSlackBotMessage(event.channelId, {
      text: [
        ':thinking_face: 返信内容を理解できませんでした。以下の形式で返信してください:',
        '',
        '*アラート解決:*',
        '• `確認済み` / `対応済み` — 全アラートを解決',
        '• `矢野 礼子 確認済み` — 特定スタッフのアラートを解決',
        '• `矢野 礼子 4/2 確認済み` — 特定日のアラートを解決',
        '',
        '*アラート無視ルール:*',
        '• `矢野 礼子 日報不要` — このスタッフの日報アラートを今後停止',
        '',
        '*備考付き:*',
        '• `矢野 礼子 4/2 確認済み、研修のため` — メモ付きで解決',
      ].join('\n'),
    }, { thread_ts: event.threadTs })
    return result
  }

  // アクション実行
  const confirmLines: string[] = []

  for (const action of intent.actions) {
    try {
      switch (action.type) {
        case 'resolve': {
          // alerts テーブルの対応アラートを解決 (recurrence_key ベース)
          for (const alert of action.targetAlerts) {
            // recurrence_key形式: report-missing:staffId:date, attn-err:shiftId, etc.
            const { error } = await admin
              .from('alerts')
              .update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
                resolution_note: action.note || `Slackスレッドで解決 (by <@${event.userId}>)`,
              })
              .eq('recurrence_key', alert.id)
              .eq('status', 'active')

            if (error) {
              console.warn(`[thread-reply] alert resolve failed for ${alert.id}:`, error)
            }
          }
          const names = [...new Set(action.targetAlerts.map(a => a.staffName))]
          confirmLines.push(`:white_check_mark: ${names.join('、')} のアラート ${action.targetAlerts.length}件を解決しました`)
          result.actions.push(`resolved:${action.targetAlerts.length}`)
          break
        }

        case 'ignore': {
          // alert_ignores テーブルにルール追加
          for (const rule of action.ignoreRules) {
            const { error } = await admin
              .from('alert_ignores')
              .upsert({
                alert_type: rule.alertType,
                staff_id: rule.staffId,
                project_id: rule.projectId,
                reason: rule.reason || `Slackスレッドで設定 (by <@${event.userId}>)`,
                is_active: true,
                created_by: null, // Slack経由なのでuser_idは不明
              }, { onConflict: 'alert_type,staff_id,project_id' })

            if (error) {
              console.warn(`[thread-reply] ignore rule creation failed:`, error)
            }
          }
          const names = [...new Set(action.ignoreRules.map(r => r.staffName))]
          confirmLines.push(`:no_bell: ${names.join('、')} の${action.ignoreRules[0]?.alertType === 'REPORT_MISSING' ? '日報' : ''}アラートを今後停止しました`)
          result.actions.push(`ignored:${action.ignoreRules.length}`)
          break
        }
      }
    } catch (err) {
      console.error('[thread-reply] action execution error:', err)
      confirmLines.push(`:x: エラーが発生しました: ${(err as Error).message}`)
    }
  }

  // 確認メッセージをスレッドに投稿
  if (confirmLines.length > 0) {
    await sendSlackBotMessage(event.channelId, {
      text: confirmLines.join('\n'),
    }, { thread_ts: event.threadTs })
  }

  return result
}

// ========================================
// 出退勤通知への返信処理
// ========================================

async function handleAttendanceReply(
  event: ThreadReplyEvent,
  botMessage: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any
): Promise<ProcessResult> {
  const result: ProcessResult = { handled: true, actions: [] }
  const text = event.text.trim()
  const context = botMessage.context as {
    attendanceRecordId?: string
    staffId?: string
    staffName?: string
    date?: string
    projectName?: string
  }

  if (!context?.attendanceRecordId) {
    return { handled: false, actions: [] }
  }

  // 打刻修正パターン: "退勤 18:00" or "修正: 出勤 9:00 退勤 18:00" or "メモ: 〇〇"
  const clockOutMatch = text.match(/退勤\s*[:：]?\s*(\d{1,2})[：:](\d{2})/)
  const clockInMatch = text.match(/出勤\s*[:：]?\s*(\d{1,2})[：:](\d{2})/)
  const memoMatch = text.match(/(?:メモ|備考|理由)\s*[:：]?\s*(.+)/)

  const updates: Record<string, unknown> = {}
  const confirmLines: string[] = []

  if (clockOutMatch) {
    const h = parseInt(clockOutMatch[1])
    const m = parseInt(clockOutMatch[2])
    // 当日の日付 + 指定時刻でISO文字列を作成
    const dateStr = context.date || new Date().toISOString().split('T')[0]
    const clockOutTime = `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+09:00`
    updates.clock_out = clockOutTime
    updates.clock_out_rounded = clockOutTime
    updates.status = 'clocked_out'
    confirmLines.push(`:clock${h > 12 ? h - 12 : h}: 退勤時刻を ${h}:${String(m).padStart(2, '0')} に修正しました`)
  }

  if (clockInMatch) {
    const h = parseInt(clockInMatch[1])
    const m = parseInt(clockInMatch[2])
    const dateStr = context.date || new Date().toISOString().split('T')[0]
    const clockInTime = `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+09:00`
    updates.clock_in = clockInTime
    updates.clock_in_rounded = clockInTime
    confirmLines.push(`:clock${h > 12 ? h - 12 : h}: 出勤時刻を ${h}:${String(m).padStart(2, '0')} に修正しました`)
  }

  if (memoMatch) {
    updates.note = memoMatch[1].trim()
    confirmLines.push(`:memo: メモを追加しました`)
  }

  if (Object.keys(updates).length > 0) {
    updates.modification_reason = `Slackスレッドで修正 (by <@${event.userId}>)`
    updates.status = updates.status || 'modified'

    // work_minutes 再計算
    if (updates.clock_in || updates.clock_out) {
      // 既存レコード取得
      const { data: existing } = await admin
        .from('attendance_records')
        .select('clock_in_rounded, clock_out_rounded, break_minutes')
        .eq('id', context.attendanceRecordId)
        .single()

      if (existing) {
        const cin = updates.clock_in_rounded
          ? new Date(updates.clock_in_rounded as string)
          : existing.clock_in_rounded ? new Date(existing.clock_in_rounded) : null
        const cout = updates.clock_out_rounded
          ? new Date(updates.clock_out_rounded as string)
          : existing.clock_out_rounded ? new Date(existing.clock_out_rounded) : null

        if (cin && cout) {
          const workMin = Math.round((cout.getTime() - cin.getTime()) / 60000) - (existing.break_minutes || 0)
          updates.work_minutes = Math.max(0, workMin)
          updates.overtime_minutes = Math.max(0, workMin - 480)
        }
      }
    }

    const { error } = await admin
      .from('attendance_records')
      .update(updates)
      .eq('id', context.attendanceRecordId)

    if (error) {
      confirmLines.push(`:x: 更新エラー: ${error.message}`)
    }

    result.actions.push('attendance_modified')
  } else if (/確認|OK|了解|承知/.test(text)) {
    confirmLines.push(':white_check_mark: 確認しました')
    result.actions.push('acknowledged')
  } else {
    await sendSlackBotMessage(event.channelId, {
      text: [
        ':thinking_face: 返信内容を理解できませんでした。以下の形式で返信してください:',
        '',
        '• `退勤 18:00` — 退勤時刻を修正',
        '• `出勤 9:00 退勤 18:00` — 出退勤両方修正',
        '• `メモ: 〇〇` — メモを追加',
        '• `確認` — 確認済みにする',
      ].join('\n'),
    }, { thread_ts: event.threadTs })
    return result
  }

  if (confirmLines.length > 0) {
    await sendSlackBotMessage(event.channelId, {
      text: `${context.staffName || ''}（${context.date || ''}）\n${confirmLines.join('\n')}`,
    }, { thread_ts: event.threadTs })
  }

  return result
}

// ========================================
// 日報通知への返信処理
// ========================================

async function handleReportReply(
  event: ThreadReplyEvent,
  botMessage: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any
): Promise<ProcessResult> {
  const result: ProcessResult = { handled: true, actions: [] }
  const text = event.text.trim()
  const context = botMessage.context as {
    reportId?: string
    staffId?: string
    staffName?: string
    date?: string
  }

  if (!context?.reportId) return { handled: false, actions: [] }

  // "承認" or "OK" or "LGTM"
  if (/^(承認|OK|LGTM|いいね|👍|問題なし)$/i.test(text)) {
    const { error } = await admin
      .from('work_reports')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        review_comment: `Slackスレッドで承認 (by <@${event.userId}>)`,
      })
      .eq('id', context.reportId)
      .in('status', ['submitted', 'reviewing'])

    if (error) {
      await sendSlackBotMessage(event.channelId, {
        text: `:x: 承認エラー: ${error.message}`,
      }, { thread_ts: event.threadTs })
    } else {
      await sendSlackBotMessage(event.channelId, {
        text: `:white_check_mark: ${context.staffName || ''}（${context.date || ''}）の日報を承認しました`,
      }, { thread_ts: event.threadTs })
      result.actions.push('report_approved')
    }
    return result
  }

  // "差戻し: コメント" or "修正: コメント"
  const rejectMatch = text.match(/^(?:差戻し?|修正|やり直し|NG)\s*[:：]?\s*(.+)/)
  if (rejectMatch) {
    const comment = rejectMatch[1].trim()
    const { error } = await admin
      .from('work_reports')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        review_comment: comment,
      })
      .eq('id', context.reportId)
      .in('status', ['submitted', 'reviewing'])

    if (error) {
      await sendSlackBotMessage(event.channelId, {
        text: `:x: 差戻しエラー: ${error.message}`,
      }, { thread_ts: event.threadTs })
    } else {
      // 本人にDM通知
      if (context.staffId) {
        const slackUserId = await resolveStaffSlackUserId(context.staffId)
        if (slackUserId) {
          await sendSlackBotMessage(slackUserId, {
            text: `:warning: ${context.date || ''}の日報が差戻されました\nコメント: ${comment}`,
          })
        }
      }
      await sendSlackBotMessage(event.channelId, {
        text: `:leftwards_arrow_with_hook: ${context.staffName || ''}（${context.date || ''}）の日報を差戻しました\nコメント: ${comment}`,
      }, { thread_ts: event.threadTs })
      result.actions.push('report_rejected')
    }
    return result
  }

  return { handled: false, actions: [] }
}

// ========================================
// シフト通知への返信処理
// ========================================

async function handleShiftReply(
  event: ThreadReplyEvent,
  botMessage: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any
): Promise<ProcessResult> {
  const result: ProcessResult = { handled: true, actions: [] }
  const text = event.text.trim()
  const context = botMessage.context as {
    shiftId?: string
    staffId?: string
    staffName?: string
    date?: string
  }

  if (!context?.shiftId) return { handled: false, actions: [] }

  if (/^(承認|OK|LGTM|いいね|👍)$/i.test(text)) {
    const { error } = await admin
      .from('shifts')
      .update({
        status: 'APPROVED',
        approved_at: new Date().toISOString(),
        approved_by: null, // Slack経由
      })
      .eq('id', context.shiftId)
      .eq('status', 'SUBMITTED')

    if (!error) {
      await sendSlackBotMessage(event.channelId, {
        text: `:white_check_mark: ${context.staffName || ''}（${context.date || ''}）のシフトを承認しました`,
      }, { thread_ts: event.threadTs })
      result.actions.push('shift_approved')
    }
    return result
  }

  const rejectMatch = text.match(/^(?:却下|NG|修正)\s*[:：]?\s*(.+)/)
  if (rejectMatch) {
    const reason = rejectMatch[1].trim()
    const { error } = await admin
      .from('shifts')
      .update({
        status: 'REJECTED',
        reject_reason: reason,
      })
      .eq('id', context.shiftId)
      .eq('status', 'SUBMITTED')

    if (!error) {
      await sendSlackBotMessage(event.channelId, {
        text: `:x: ${context.staffName || ''}（${context.date || ''}）のシフトを却下しました\n理由: ${reason}`,
      }, { thread_ts: event.threadTs })
      result.actions.push('shift_rejected')
    }
    return result
  }

  return { handled: false, actions: [] }
}

// ========================================
// アラート返信の意図解析
// ========================================

interface AlertReplyIntent {
  actions: Array<
    | { type: 'resolve'; targetAlerts: Array<{ id: string; staffName: string; date: string }>; note?: string }
    | { type: 'ignore'; ignoreRules: Array<{ alertType: string; staffId: string | null; staffName: string; projectId: string | null; reason?: string }> }
  >
}

function parseAlertReplyIntent(
  text: string,
  alerts: Array<{ id: string; type: string; staffId: string | null; staffName: string; projectId: string | null; date: string; description: string }>
): AlertReplyIntent | null {
  const normalized = text.trim()

  // パターン1: 全体アクション — "確認済み" "全部OK" "対応済み" "全て確認"
  if (/^(全[てべ]?確認|全部OK|確認済み|対応済み|OK|了解|全件対応済み?|👍)$/i.test(normalized)) {
    return {
      actions: [{
        type: 'resolve',
        targetAlerts: alerts.map(a => ({ id: a.id, staffName: a.staffName, date: a.date })),
      }],
    }
  }

  // パターン2: スタッフ指定 — "矢野 礼子 確認済み" "矢野確認済み"
  // パターン3: スタッフ+日付指定 — "矢野 礼子 4/2 確認済み"
  // パターン4: 無視ルール — "矢野 礼子 日報不要" "植木 万衣 アラート停止"

  // まずスタッフ名を抽出
  const matchedStaff = findMatchingStaff(normalized, alerts)

  if (matchedStaff.length > 0) {
    // 日報不要/アラート停止パターン
    if (/日報不要|アラート停止|通知停止|除外|不要/.test(normalized)) {
      const noteMatch = normalized.match(/[、,]\s*(.+)$/)
      return {
        actions: [{
          type: 'ignore',
          ignoreRules: matchedStaff.map(s => ({
            alertType: 'REPORT_MISSING',
            staffId: s.staffId,
            staffName: s.staffName,
            projectId: s.projectId,
            reason: noteMatch ? noteMatch[1].trim() : undefined,
          })),
        }],
      }
    }

    // 日付指定あり → 特定アラートを解決
    const dateMatch = normalized.match(/(\d{1,2})[\/\-](\d{1,2})/)
    let targetAlerts = alerts.filter(a =>
      matchedStaff.some(s => s.staffId === a.staffId)
    )

    if (dateMatch) {
      const month = dateMatch[1].padStart(2, '0')
      const day = dateMatch[2].padStart(2, '0')
      targetAlerts = targetAlerts.filter(a =>
        a.date.endsWith(`-${month}-${day}`) || a.date.includes(`-${month}-${day}`)
      )
    }

    if (/確認|OK|対応|了解|承知|済/.test(normalized)) {
      const noteMatch = normalized.match(/[、,]\s*(.+)$/)
      return {
        actions: [{
          type: 'resolve',
          targetAlerts: targetAlerts.map(a => ({ id: a.id, staffName: a.staffName, date: a.date })),
          note: noteMatch ? noteMatch[1].trim() : undefined,
        }],
      }
    }
  }

  // 複数行対応: 各行を個別に処理
  const lines = normalized.split('\n').filter(l => l.trim())
  if (lines.length > 1) {
    const combinedActions: AlertReplyIntent['actions'] = []
    for (const line of lines) {
      const lineIntent = parseAlertReplyIntent(line, alerts)
      if (lineIntent) {
        combinedActions.push(...lineIntent.actions)
      }
    }
    if (combinedActions.length > 0) {
      return { actions: combinedActions }
    }
  }

  return null
}

function findMatchingStaff(
  text: string,
  alerts: Array<{ staffId: string | null; staffName: string; projectId: string | null }>
): Array<{ staffId: string | null; staffName: string; projectId: string | null }> {
  const uniqueStaff = new Map<string, { staffId: string | null; staffName: string; projectId: string | null }>()

  for (const a of alerts) {
    if (!a.staffId) continue
    if (uniqueStaff.has(a.staffId)) continue

    // フルネームマッチ: "矢野 礼子" or "矢野礼子"
    const nameNoSpace = a.staffName.replace(/\s+/g, '')
    if (text.includes(a.staffName) || text.includes(nameNoSpace)) {
      uniqueStaff.set(a.staffId, { staffId: a.staffId, staffName: a.staffName, projectId: a.projectId })
      continue
    }

    // 苗字のみマッチ: "矢野"
    const lastName = a.staffName.split(/\s+/)[0]
    if (lastName && lastName.length >= 2 && text.includes(lastName)) {
      uniqueStaff.set(a.staffId, { staffId: a.staffId, staffName: a.staffName, projectId: a.projectId })
    }
  }

  return [...uniqueStaff.values()]
}
