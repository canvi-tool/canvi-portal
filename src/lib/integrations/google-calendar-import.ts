/**
 * Phase 1: Googleカレンダー → Canvi shifts 取込エンジン
 *
 * 仕様:
 * - primary カレンダーのみ対象
 * - Canvi発のイベント (extendedProperties.private.canviShiftId) はスキップ（二重取込防止）
 * - 既存の external_event_id と一致すれば差分UPDATE、なければINSERT
 * - 新規取込は source='google_calendar', project_id=NULL, needs_project_assignment=TRUE
 * - 終日予定はスキップ（Phase 2以降で対応検討）
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidTokenForUser } from '@/lib/integrations/google-token'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  deleted: number
  errors: string[]
}

/**
 * 指定スタッフの primary カレンダー → shifts 取込
 */
export async function syncFromGoogleCalendarForStaff(params: {
  staffId: string
  userId: string
  timeMin: string // ISO8601
  timeMax: string // ISO8601
}): Promise<ImportResult> {
  const { staffId, userId, timeMin, timeMax } = params
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, deleted: 0, errors: [] }

  const token = await getValidTokenForUser(userId)
  if (!token) {
    result.errors.push('Google認証トークンが見つかりません')
    return result
  }

  const client = new GoogleCalendarClient(token.accessToken, token.refreshToken || undefined)

  let events
  try {
    events = await client.listEventsForImport({ timeMin, timeMax })
  } catch (e) {
    result.errors.push(`GCal取得失敗: ${(e as Error).message}`)
    return result
  }

  const admin = createAdminClient()

  // 自分以外のCanviユーザーがオーガナイザーのイベントは、招待された側の再取込による重複生成を避けるためスキップする
  // （Canvi発のイベントは createEvent で shared extendedProperties に canviShiftId を持つので基本そちらで判定されるが、
  //  旧イベント互換として organizer のメールドメイン一致もフォールバック）
  const { data: canviUsers } = await admin.from('users').select('email')
  const canviEmailSet = new Set(
    (canviUsers || [])
      .map((u) => (u as { email?: string | null }).email)
      .filter((e): e is string => !!e)
      .map((e) => e.toLowerCase())
  )
  // 自分自身の email を取得（除外判定用）
  const { data: meUser } = await admin.from('users').select('email').eq('id', userId).maybeSingle()
  const myEmail = ((meUser as { email?: string | null } | null)?.email || '').toLowerCase()

  // 今回listEventsForImportで見えた(かつCanvi発でない)GCalイベントIDを記録する。
  // これに含まれない既存取込(pending / 昇格済みshifts)はGCal側で削除/非公開された可能性があり、
  // getEventById で確実に確認してから soft-delete する。
  const seenExternalIds = new Set<string>()

  for (const ev of events) {
    // Canvi発のイベント → shifts.id を直接検索して
    // GCal 側で変更された title/notes/start/end/meet_url を反映する
    if (ev.canviShiftId) {
      seenExternalIds.add(ev.id)
      if (ev.isAllDay) {
        result.skipped += 1
        continue
      }
      try {
        const startDate = new Date(ev.start)
        const endDate = new Date(ev.end)
        const shiftDate = toJstDateStr(startDate)
        const startTime = toJstTimeStr(startDate)
        const endTime = toJstTimeStr(endDate)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: canviShiftList } = await (admin.from('shifts') as any)
          .select('id, shift_date, start_time, end_time, title, notes, google_meet_url, external_updated_at')
          .eq('id', ev.canviShiftId)
          .is('deleted_at', null)
          .limit(1) as { data: Array<{ id: string; shift_date: string; start_time: string; end_time: string; title: string | null; notes: string | null; google_meet_url: string | null; external_updated_at: string | null }> | null }
        const canviShift = canviShiftList && canviShiftList[0]
        if (!canviShift) {
          result.skipped += 1
          continue
        }
        if (
          ev.updated &&
          canviShift.external_updated_at &&
          new Date(ev.updated).getTime() <= new Date(canviShift.external_updated_at).getTime()
        ) {
          result.skipped += 1
          continue
        }
        const curStart = (canviShift.start_time || '').slice(0, 5)
        const curEnd = (canviShift.end_time || '').slice(0, 5)
        const newTitle = ev.summary || null
        const newDesc = ev.description || null
        const newMeetUrl = ev.meetUrl || null
        const cleanNotes = canviShift.notes && canviShift.notes.startsWith('gcal:') ? null : canviShift.notes
        const changed =
          canviShift.shift_date !== shiftDate ||
          curStart !== startTime ||
          curEnd !== endTime ||
          (canviShift.title || null) !== newTitle ||
          cleanNotes !== newDesc ||
          (canviShift.google_meet_url || null) !== newMeetUrl
        if (changed) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updatePayload: any = {
            shift_date: shiftDate,
            start_time: startTime,
            end_time: endTime,
            title: newTitle,
            notes: newDesc,
            google_meet_url: newMeetUrl,
            external_updated_at: ev.updated || null,
            google_calendar_synced: true,
            // external_event_id を常にセット（重複生成防止の要）
            external_event_id: ev.id,
            google_calendar_event_id: ev.id,
            updated_at: new Date().toISOString(),
          }
          const { error: upErr } = await admin
            .from('shifts')
            .update(updatePayload)
            .eq('id', canviShift.id)
          if (upErr) result.errors.push(`Canvi発shift UPDATE失敗 ${ev.id}: ${upErr.message}`)
          else result.updated += 1
        } else {
          // 変更なしでも external_event_id が未設定なら埋める
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin.from('shifts') as any)
            .update({ external_event_id: ev.id, google_calendar_event_id: ev.id })
            .eq('id', canviShift.id)
            .is('external_event_id', null)
          result.skipped += 1
        }
      } catch (e) {
        result.errors.push(`Canvi発shift処理失敗 ${ev.id}: ${(e as Error).message}`)
      }
      continue
    }
    // 旧イベント互換: 他のCanviユーザーがオーガナイザー → Canvi発の招待なのでスキップ
    const organizer = (ev.organizerEmail || '').toLowerCase()
    if (organizer && organizer !== myEmail && canviEmailSet.has(organizer)) {
      seenExternalIds.add(ev.id)
      result.skipped += 1
      continue
    }
    seenExternalIds.add(ev.id)
    // 終日予定 → Phase 1ではスキップ
    if (ev.isAllDay) {
      result.skipped += 1
      continue
    }

    const startDate = new Date(ev.start)
    const endDate = new Date(ev.end)
    const shiftDate = toJstDateStr(startDate)
    const startTime = toJstTimeStr(startDate)
    const endTime = toJstTimeStr(endDate)

    // 既にshiftsに昇格済みなら → GCal発シフト(source='google_calendar')のみ時間/タイトル差分を反映し、
    // Canvi発シフト(source != 'google_calendar')はCanvi側が真実ソースなので触らない。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: promotedList } = await (admin.from('shifts') as any)
      .select('id, source, shift_date, start_time, end_time, title, notes, external_updated_at')
      .eq('staff_id', staffId)
      .or(`external_event_id.eq.${ev.id},google_calendar_event_id.eq.${ev.id}`)
      .is('deleted_at', null)
      .limit(1) as { data: Array<{ id: string; source: string | null; shift_date: string; start_time: string; end_time: string; title: string | null; notes: string | null; external_updated_at: string | null }> | null }
    if (promotedList && promotedList[0]) {
      const promoted = promotedList[0]
      // Canvi発シフトは触らない
      if (promoted.source !== 'google_calendar') {
        result.skipped += 1
        continue
      }
      const curStart = (promoted.start_time || '').slice(0, 5)
      const curEnd = (promoted.end_time || '').slice(0, 5)
      const newTitle = ev.summary || null
      const newDesc = ev.description || null
      // notes に "gcal:" プレフィックスが付いている旧データは無視して比較
      const cleanNotes = promoted.notes && promoted.notes.startsWith('gcal:') ? null : promoted.notes
      const changed =
        promoted.shift_date !== shiftDate ||
        curStart !== startTime ||
        curEnd !== endTime ||
        (promoted.title || null) !== newTitle ||
        cleanNotes !== newDesc ||
        (ev.updated && promoted.external_updated_at !== ev.updated)
      if (changed) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatePayload: any = {
          shift_date: shiftDate,
          start_time: startTime,
          end_time: endTime,
          title: newTitle,
          notes: newDesc,
          external_updated_at: ev.updated || null,
          google_calendar_synced: true,
          updated_at: new Date().toISOString(),
        }
        const { error: upErr } = await admin
          .from('shifts')
          .update(updatePayload)
          .eq('id', promoted.id)
        if (upErr) result.errors.push(`昇格済shift UPDATE失敗 ${ev.id}: ${upErr.message}`)
        else result.updated += 1
      } else {
        result.skipped += 1
      }
      continue
    }

    // gcal_pending_events に既存があるか
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendingList } = await (admin as any).from('gcal_pending_events')
      .select('id, event_date, start_time, end_time, excluded')
      .eq('staff_id', staffId)
      .eq('external_event_id', ev.id)
      .limit(1) as { data: { id: string; event_date: string; start_time: string; end_time: string; excluded: boolean }[] | null }
    const pending = pendingList && pendingList[0] ? pendingList[0] : null

    // 永続除外されているものは触らない
    if (pending?.excluded) {
      result.skipped += 1
      continue
    }

    if (pending) {
      const changed =
        pending.event_date !== shiftDate ||
        pending.start_time.slice(0, 5) !== startTime ||
        pending.end_time.slice(0, 5) !== endTime
      if (changed) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (admin as any).from('gcal_pending_events')
          .update({
            event_date: shiftDate,
            start_time: startTime,
            end_time: endTime,
            title: ev.summary || null,
            description: ev.description || null,
            external_updated_at: ev.updated || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pending.id)
        if (error) result.errors.push(`UPDATE失敗 ${ev.id}: ${error.message}`)
        else result.updated += 1
      } else {
        result.skipped += 1
      }
      continue
    }

    // 新規INSERT → gcal_pending_events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertPayload: any = {
      staff_id: staffId,
      external_event_id: ev.id,
      external_calendar_id: 'primary',
      external_updated_at: ev.updated || null,
      event_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      title: ev.summary || null,
      description: ev.description || null,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from('gcal_pending_events').insert(insertPayload)
    if (error) result.errors.push(`INSERT失敗 ${ev.id}: ${error.message}`)
    else result.created += 1
  }

  // --- 削除検知 ---
  // listEventsForImport の対象期間内で、前回以前に取込済みの external_event_id のうち、
  // 今回のリストに存在しないもの = GCal側で削除/非公開された可能性あり。
  // ただし list は showDeleted=false で取るので、保険として getEventById で 404/cancelled を確認してから soft-delete する。
  //
  // 対象:
  // 1) shifts (source='google_calendar' かつ external_event_id がある) → ソフト削除
  // 2) gcal_pending_events (未昇格の pending) → 物理削除
  //
  // Canvi発のシフト (source != 'google_calendar', 例えば source=null / 'canvi') は対象外。
  try {
    const timeMinDate = toJstDateStr(new Date(timeMin))
    const timeMaxDate = toJstDateStr(new Date(timeMax))

    // 既存の昇格済みshifts（このスタッフ×期間×GCal由来）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promotedRes = await (admin.from('shifts') as any)
      .select('id, external_event_id, source, shift_date')
      .eq('staff_id', staffId)
      .eq('source', 'google_calendar')
      .not('external_event_id', 'is', null)
      .is('deleted_at', null)
      .gte('shift_date', timeMinDate)
      .lte('shift_date', timeMaxDate)
    const promotedShifts = promotedRes.data as Array<{ id: string; external_event_id: string | null; source: string | null; shift_date: string }> | null

    const candidateShifts = (promotedShifts || []).filter(
      (s) => s.external_event_id && !seenExternalIds.has(s.external_event_id)
    )

    for (const s of candidateShifts) {
      if (!s.external_event_id) continue
      try {
        const ev = await client.getEventById('primary', s.external_event_id)
        if (ev === null) {
          // GCal側で削除 or cancelled
          const nowIso = new Date().toISOString()
          const { error: delErr } = await admin
            .from('shifts')
            .update({ deleted_at: nowIso, updated_at: nowIso })
            .eq('id', s.id)
            .is('deleted_at', null)
          if (delErr) result.errors.push(`DELETE shift失敗 ${s.id}: ${delErr.message}`)
          else result.deleted += 1
        }
      } catch (e) {
        // 一過性エラーは無視して次へ（誤削除防止）
        result.errors.push(`GCal verify失敗 ${s.external_event_id}: ${(e as Error).message}`)
      }
    }

    // pending_events の掃除
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendingAll } = await (admin as any).from('gcal_pending_events')
      .select('id, external_event_id, event_date, excluded')
      .eq('staff_id', staffId)
      .gte('event_date', timeMinDate)
      .lte('event_date', timeMaxDate) as { data: Array<{ id: string; external_event_id: string; event_date: string; excluded: boolean }> | null }

    const candidatePending = (pendingAll || []).filter(
      (p) => !p.excluded && p.external_event_id && !seenExternalIds.has(p.external_event_id)
    )

    for (const p of candidatePending) {
      try {
        const ev = await client.getEventById('primary', p.external_event_id)
        if (ev === null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: delErr } = await (admin as any)
            .from('gcal_pending_events')
            .delete()
            .eq('id', p.id)
          if (delErr) result.errors.push(`DELETE pending失敗 ${p.id}: ${delErr.message}`)
          else result.deleted += 1
        }
      } catch (e) {
        result.errors.push(`GCal verify失敗 pending ${p.external_event_id}: ${(e as Error).message}`)
      }
    }
  } catch (e) {
    result.errors.push(`削除検知処理エラー: ${(e as Error).message}`)
  }

  return result
}

function toJstDateStr(d: Date): string {
  // UTC → JST (+9h) → YYYY-MM-DD
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

function toJstTimeStr(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(11, 16)
}
