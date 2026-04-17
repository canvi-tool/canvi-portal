import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendProjectNotification,
  buildShiftAttendanceDiffNotification,
} from '@/lib/integrations/slack'

/**
 * シフトvs打刻の乖離チェック Cron Job (Phase 3)
 *
 * 毎日 20:00 JST に実行 (vercel.json: "0 11 * * *" = UTC 11:00 = JST 20:00)
 * 丸め後 (clock_in_rounded / clock_out_rounded) の打刻と シフト時刻を比較し、
 * 1分以上の乖離をプロジェクトチャンネルに通知。
 * 丸め適用範囲 (±10分) を超えた打刻のみが通知対象となる。
 */
export async function GET(request: NextRequest) {
  // Cron認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // JSTで今日の日付（?date=YYYY-MM-DD で上書き可能、デバッグ/手動実行用）
  const dateOverride = request.nextUrl.searchParams.get('date')
  const now = new Date()
  const jstOffset = 9 * 60 * 60 * 1000
  const jstNow = new Date(now.getTime() + jstOffset)
  const today = dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)
    ? dateOverride
    : jstNow.toISOString().split('T')[0]

  const DIFF_THRESHOLD_MINUTES = 1

  const results = {
    checked: 0,
    mismatched: 0,
    errors: 0,
    details: [] as { staffName: string; project: string; diffMinutes: number }[],
  }

  try {
    // 今日のシフトを取得
    const { data: todayShifts } = await admin
      .from('shifts')
      .select('id, staff_id, project_id, start_time, end_time, staff:staff_id(id, last_name, first_name, user_id, custom_fields), project:project_id(id, name, slack_channel_id)')
      .eq('shift_date', today)
      .is('deleted_at', null)
      .in('status', ['APPROVED', 'SUBMITTED'])

    if (!todayShifts || todayShifts.length === 0) {
      return NextResponse.json({
        success: true,
        date: today,
        message: '今日のシフトがありません',
        results,
      })
    }

    // 今日の打刻を取得 (丸め後の値を優先して使用)
    const { data: todayAttendance } = await admin
      .from('attendance_records')
      .select('id, user_id, staff_id, project_id, clock_in, clock_out, clock_in_rounded, clock_out_rounded')
      .eq('date', today)
      .is('deleted_at', null)
      .not('clock_in', 'is', null)

    // staff_id + project_id -> attendance 配列マップ
    //
    // 以前は Map<key, single> で最終書き込みが勝つ実装だったため、同日に
    // 同一 staff/project で 2 件以上シフトがあると 1 件の打刻を全シフトが
    // 共有参照してしまい「午後シフト(16:00~22:00) vs 午前打刻(08:00~09:40)」
    // のような 740 分の偽陽性が発生していた。
    // → リスト化し、後段で 1-to-1 greedy マッチ（開始時刻近接優先）に変更。
    // 比較は丸め後の値で行う (fallback: 生値)
    type AttRec = { id: string; clock_in: string; clock_out: string | null }
    const attendanceMap = new Map<string, AttRec[]>()
    for (const att of (todayAttendance || []) as Array<{
      id: string
      staff_id: string | null
      project_id: string | null
      clock_in: string
      clock_out: string | null
      clock_in_rounded: string | null
      clock_out_rounded: string | null
    }>) {
      if (!att.clock_in) continue
      const key = `${att.staff_id}__${att.project_id || ''}`
      const rec: AttRec = {
        id: att.id,
        clock_in: att.clock_in_rounded || att.clock_in,
        clock_out: att.clock_out_rounded || att.clock_out,
      }
      const list = attendanceMap.get(key)
      if (list) list.push(rec)
      else attendanceMap.set(key, [rec])
    }
    // 各グループ内は clock_in 昇順でソート（近接マッチを安定化）
    for (const list of attendanceMap.values()) {
      list.sort((a, b) => toJstMinutes(a.clock_in, jstOffset) - toJstMinutes(b.clock_in, jstOffset))
    }

    // ──────────────────────────────────────────────────────────
    // 1-to-1 greedy マッチング (staff_id + project_id 単位)
    //
    // shift の start_time に最も近い clock_in を持つ打刻を「そのシフトの
    // 実績」として 1 件だけ割り当てる。1 度割り当てた打刻は他のシフトに
    // 再利用しない。これにより:
    //   shifts = [08:00~09:30, 16:00~22:00]
    //   attendance = [08:00~09:40]
    // は shift[0] ↔ att[0] のみペア成立、shift[1] は「打刻なし」として
    // このジョブでは通知しない (attendance-alerts 側の責務)。
    // ──────────────────────────────────────────────────────────
    const shiftToAttendance = new Map<string, AttRec>() // shiftId -> 割当済み attendance

    // シフトを (staff_id, project_id) ごとにグルーピング
    const shiftsByKey = new Map<string, typeof todayShifts>()
    for (const s of todayShifts) {
      const k = `${s.staff_id}__${s.project_id || ''}`
      const list = shiftsByKey.get(k)
      if (list) list.push(s)
      else shiftsByKey.set(k, [s])
    }

    for (const [key, shifts] of shiftsByKey) {
      const attList = attendanceMap.get(key)
      if (!attList || attList.length === 0) continue

      // 開始時刻昇順でソート
      const sortedShifts = [...shifts].sort((a, b) => {
        const am = a.start_time ? timeToMinutes(a.start_time) : 0
        const bm = b.start_time ? timeToMinutes(b.start_time) : 0
        return am - bm
      })
      const pool = [...attList] // 残り attendance プール（シフトに割当てられると削除）

      for (const shift of sortedShifts) {
        if (!shift.start_time || !shift.id) continue
        if (pool.length === 0) break
        const shiftStart = timeToMinutes(shift.start_time)
        // プールから最も clock_in が近いものを選ぶ
        let bestIdx = 0
        let bestDist = Number.POSITIVE_INFINITY
        for (let i = 0; i < pool.length; i++) {
          const ci = toJstMinutes(pool[i].clock_in, jstOffset)
          const dist = Math.abs(ci - shiftStart)
          if (dist < bestDist) {
            bestDist = dist
            bestIdx = i
          }
        }
        const picked = pool.splice(bestIdx, 1)[0]
        shiftToAttendance.set(shift.id, picked)
      }
    }

    // プロジェクト別にグループ化
    const diffsByProject = new Map<string, {
      projectName: string
      slackChannelId: string | null
      entries: {
        staffName: string
        shiftTime: string
        actualTime: string
        diffMinutes: number
        attendanceRecordId: string | null
        shiftId: string | null
        staffSlackUserId: string | null
      }[]
      staffIds: string[]
      attendanceRecordIds: string[]
    }>()

    for (const shift of todayShifts) {
      results.checked++
      const staff = shift.staff as unknown as { id: string; last_name: string; first_name: string; user_id: string; custom_fields?: Record<string, unknown> | null } | null
      const project = shift.project as unknown as { id: string; name: string; slack_channel_id: string | null } | null

      if (!staff || !shift.start_time) continue

      const staffName = `${staff.last_name || ''} ${staff.first_name || ''}`.trim() || '不明'
      // 1-to-1 greedy マッチで事前割当済みの attendance を参照する。
      // シフト数 > 打刻数 の場合、未割当シフトはこの cron では通知しない
      // (打刻なし は attendance-alerts 側で通知されるため二重化を避ける)。
      const attendance = shift.id ? shiftToAttendance.get(shift.id) : undefined

      if (!attendance) continue // 打刻なし or 他シフトに割当済み -> attendance-alerts で処理

      // シフト開始 vs 実際の出勤を比較
      const shiftStartMinutes = timeToMinutes(shift.start_time)
      const clockInJst = toJstMinutes(attendance.clock_in, jstOffset)
      const clockInDiff = Math.abs(clockInJst - shiftStartMinutes)

      // シフト終了 vs 実際の退勤を比較
      let clockOutDiff = 0
      if (shift.end_time && attendance.clock_out) {
        const shiftEndMinutes = timeToMinutes(shift.end_time)
        const clockOutJst = toJstMinutes(attendance.clock_out, jstOffset)
        clockOutDiff = Math.abs(clockOutJst - shiftEndMinutes)
      }

      const maxDiff = Math.max(clockInDiff, clockOutDiff)
      if (maxDiff < DIFF_THRESHOLD_MINUTES) continue

      results.mismatched++

      const shiftTimeStr = `${shift.start_time.slice(0, 5)}~${shift.end_time ? shift.end_time.slice(0, 5) : '?'}`
      const clockInStr = formatJstTime(attendance.clock_in, jstOffset)
      const clockOutStr = attendance.clock_out ? formatJstTime(attendance.clock_out, jstOffset) : '未退勤'
      const actualTimeStr = `${clockInStr}~${clockOutStr}`

      results.details.push({ staffName, project: project?.name || '未割当', diffMinutes: maxDiff })

      const projectId = project?.id || '__no_project__'
      const existing = diffsByProject.get(projectId) || {
        projectName: project?.name || '未割当',
        slackChannelId: project?.slack_channel_id || null,
        entries: [],
        staffIds: [],
        attendanceRecordIds: [],
      }
      const staffSlackUserId =
        (staff?.custom_fields && typeof staff.custom_fields === 'object'
          ? ((staff.custom_fields as Record<string, unknown>).slack_user_id as string | undefined)
          : undefined) || null
      existing.entries.push({
        staffName,
        shiftTime: shiftTimeStr,
        actualTime: actualTimeStr,
        diffMinutes: maxDiff,
        attendanceRecordId: attendance.id || null,
        shiftId: shift.id || null,
        staffSlackUserId,
      })
      if (shift.staff_id) existing.staffIds.push(shift.staff_id)
      if (attendance.id) existing.attendanceRecordIds.push(attendance.id)
      diffsByProject.set(projectId, existing)
    }

    // プロジェクト別 × メンバー別に Slack通知（1メンバー = 1メッセージ）
    //
    // ポリシー変更: 以前は「Nメンバー分をまとめて1投稿」だったが、
    // スレッド返信（丸め/実績確定/修正依頼）が誰の乖離に紐づくのか
    // 曖昧になり積み上げが崩れたため、乖離1件=1投稿に分離する。
    for (const [projectId, info] of diffsByProject) {
      if (info.entries.length === 0) continue
      if (!info.slackChannelId) continue

      for (const entry of info.entries) {
        try {
          const notification = buildShiftAttendanceDiffNotification(entry, today, info.projectName)

          const result = await sendProjectNotification(notification, info.slackChannelId, {
            projectId: projectId !== '__no_project__' ? projectId : null,
            staffId: entry.attendanceRecordId ? info.staffIds : undefined,
          })

          // 送信成功時、当該 attendance_record のみに thread_ts を保存。
          // 後続のスレッドリプライ（ボタン処理）はこの ts にぶら下げる。
          if (result?.ts && entry.attendanceRecordId) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (admin as any)
                .from('attendance_records')
                .update({
                  slack_diff_thread_ts: result.ts,
                  slack_diff_channel_id: info.slackChannelId,
                })
                .eq('id', entry.attendanceRecordId)
            } catch (e) {
              console.error('[shift-attendance-diff] failed to save slack_diff_thread_ts:', e)
            }
          }
        } catch (err) {
          console.error(
            `[shift-attendance-diff] notification error for ${info.projectName} / ${entry.staffName}:`,
            err,
          )
          results.errors++
        }
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      results,
    })
  } catch (error) {
    console.error('[shift-attendance-diff] Cron error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

/** HH:MM:SS -> minutes since midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** ISO timestamp -> JST minutes since midnight */
function toJstMinutes(isoString: string, jstOffset: number): number {
  const date = new Date(isoString)
  const jst = new Date(date.getTime() + jstOffset)
  return jst.getUTCHours() * 60 + jst.getUTCMinutes()
}

/** ISO timestamp -> HH:MM (JST) */
function formatJstTime(isoString: string, jstOffset: number): string {
  const date = new Date(isoString)
  const jst = new Date(date.getTime() + jstOffset)
  return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`
}
