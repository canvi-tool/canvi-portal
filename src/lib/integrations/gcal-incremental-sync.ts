/**
 * Google Calendar → Canvi shifts: syncToken ベース増分同期
 *
 * Webhook 受信時・オンデマンド時に呼ばれ、前回以降の差分だけを取得して
 * gcal_pending_events / shifts を最小コストで更新する。
 *
 * 初回（syncToken未保持）は timeMin/timeMax の範囲でフルシンクを行い、
 * 2回目以降の nextSyncToken を gcal_sync_state に保存する。
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'

export interface IncrementalSyncResult {
  mode: 'incremental' | 'full'
  changed: number
  deleted: number
  errors: string[]
}

function toJstDateStr(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}
function toJstTimeStr(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(11, 16)
}

export async function runIncrementalSyncForStaff(params: {
  userId: string
  staffId: string
  fallbackRangeDays?: number
}): Promise<IncrementalSyncResult> {
  const { userId, staffId } = params
  const fallbackRangeDays = params.fallbackRangeDays ?? 60
  const result: IncrementalSyncResult = { mode: 'incremental', changed: 0, deleted: 0, errors: [] }

  const admin = createAdminClient()

  // token fetch と gcal_sync_state クエリは独立 → 並列実行
  const [token, { data: state }] = await Promise.all([
    getValidTokenForUser(userId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('gcal_sync_state')
      .select('id, sync_token')
      .eq('staff_id', staffId)
      .eq('calendar_id', 'primary')
      .maybeSingle() as Promise<{ data: { id: string; sync_token: string | null } | null }>,
  ])
  if (!token) {
    result.errors.push('no_google_token')
    return result
  }
  const client = await GoogleCalendarClient.create(token.accessToken, token.refreshToken || undefined)

  const now = new Date()
  const rangeStart = new Date(now.getTime() - fallbackRangeDays * 24 * 60 * 60 * 1000)
  const rangeEnd = new Date(now.getTime() + fallbackRangeDays * 24 * 60 * 60 * 1000)
  const timeMin = rangeStart.toISOString()
  const timeMax = rangeEnd.toISOString()

  let listResult: Awaited<ReturnType<typeof client.listEventsIncremental>>
  try {
    if (state?.sync_token) {
      listResult = await client.listEventsIncremental({ syncToken: state.sync_token })
      if (listResult && listResult.tokenExpired) {
        // 410 → フル再同期
        listResult = await client.listEventsIncremental({ timeMin, timeMax })
        result.mode = 'full'
      }
    } else {
      listResult = await client.listEventsIncremental({ timeMin, timeMax })
      result.mode = 'full'
    }
  } catch (e) {
    result.errors.push(`gcal_list_failed: ${(e as Error).message}`)
    return result
  }

  if (!listResult) {
    result.errors.push('gcal_list_null')
    return result
  }

  // 自分以外の Canvi ユーザー organizer の Canvi 発イベントはスキップ
  // 2つの独立クエリを並列実行
  const [{ data: canviUsers }, { data: meUser }] = await Promise.all([
    admin.from('users').select('email'),
    admin.from('users').select('email').eq('id', userId).maybeSingle(),
  ])
  const canviEmailSet = new Set(
    (canviUsers || [])
      .map((u) => (u as { email?: string | null }).email)
      .filter((e): e is string => !!e)
      .map((e) => e.toLowerCase())
  )
  const myEmail = ((meUser as { email?: string | null } | null)?.email || '').toLowerCase()

  // キャンセル（削除）イベントを先に処理する
  // waitUntil タイムアウト対策: 削除は最優先で処理し、更新は後で行う
  const cancelledEvents = listResult.events.filter(ev => ev.status === 'cancelled')
  const otherEvents = listResult.events.filter(ev => ev.status !== 'cancelled')

  // 1) キャンセルイベントを並列処理（最優先）
  if (cancelledEvents.length > 0) {
    console.log(`[gcal-sync] Processing ${cancelledEvents.length} cancelled events for staff=${staffId}`)
    await Promise.all(cancelledEvents.map(async (ev) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: promoted, error: findErr } = await (admin.from('shifts') as any)
          .select('id')
          .eq('staff_id', staffId)
          .or(`external_event_id.eq.${ev.id},google_calendar_event_id.eq.${ev.id}`)
          .is('deleted_at', null)
          .limit(1) as { data: Array<{ id: string }> | null; error: unknown }
        if (findErr) {
          console.error(`[gcal-sync] Cancel find error for event=${ev.id}:`, findErr)
        }
        if (promoted && promoted[0]) {
          const nowIso = new Date().toISOString()
          const { error: delErr } = await admin
            .from('shifts')
            .update({ deleted_at: nowIso, updated_at: nowIso })
            .eq('id', promoted[0].id)
          if (delErr) {
            console.error(`[gcal-sync] Cancel soft-delete error shift=${promoted[0].id}:`, delErr)
          } else {
            console.log(`[gcal-sync] Soft-deleted shift=${promoted[0].id} for cancelled event=${ev.id}`)
            result.deleted += 1
          }
        } else {
          console.log(`[gcal-sync] No matching shift for cancelled event=${ev.id} (staff=${staffId})`)
        }
        // pending_events を物理削除
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from('gcal_pending_events')
          .delete()
          .eq('staff_id', staffId)
          .eq('external_event_id', ev.id)
      } catch (e) {
        result.errors.push(`cancel_${ev.id}: ${(e as Error).message}`)
        console.error(`[gcal-sync] Cancel handler error event=${ev.id}:`, e)
      }
    }))
  }

  // 2) 更新・新規イベントを並列処理
  await Promise.all(otherEvents.map(async (ev) => {
    try {

      // Canvi 発（extendedProperties に canviShiftId）→ shifts.id 直接検索し、
      // GCal 側で加えられた title/notes/start/end/meet_url の変更だけ UPDATE する
      // (逆上書き防止のため external_updated_at を比較)
      if (ev.canviShiftId) {
        if (ev.isAllDay || !ev.start || !ev.end) return
        const startDate = new Date(ev.start)
        const endDate = new Date(ev.end)
        const shiftDate = toJstDateStr(startDate)
        const startTime = toJstTimeStr(startDate)
        const endTime = toJstTimeStr(endDate)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: canviShiftList } = await (admin.from('shifts') as any)
          .select('id, shift_date, start_time, end_time, title, notes, google_meet_url, external_updated_at, attendees')
          .eq('id', ev.canviShiftId)
          .is('deleted_at', null)
          .limit(1) as { data: Array<{ id: string; shift_date: string; start_time: string; end_time: string; title: string | null; notes: string | null; google_meet_url: string | null; external_updated_at: string | null; attendees: Array<{ email: string; name?: string }> | null }> | null }
        const canviShift = canviShiftList && canviShiftList[0]
        if (!canviShift) return
        // 逆上書き防止: GCal 側の更新時刻が古ければ何もしない
        if (
          ev.updated &&
          canviShift.external_updated_at &&
          new Date(ev.updated).getTime() < new Date(canviShift.external_updated_at).getTime()
        ) {
          return
        }
        const curStart = (canviShift.start_time || '').slice(0, 5)
        const curEnd = (canviShift.end_time || '').slice(0, 5)
        const newTitle = ev.summary || null
        const newDesc = ev.description || null
        const newMeetUrl = ev.meetUrl || null
        const newAttendees = (ev.attendees || [])
          .filter(a => !a.organizer)
          .map(a => ({ email: a.email, name: a.displayName || undefined }))
        const cleanNotes = canviShift.notes && canviShift.notes.startsWith('gcal:') ? null : canviShift.notes
        const changed =
          canviShift.shift_date !== shiftDate ||
          curStart !== startTime ||
          curEnd !== endTime ||
          (canviShift.title || null) !== newTitle ||
          cleanNotes !== newDesc ||
          (canviShift.google_meet_url || null) !== newMeetUrl ||
          JSON.stringify(canviShift.attendees || []) !== JSON.stringify(newAttendees)
        if (changed) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updatePayload: any = {
            shift_date: shiftDate,
            start_time: startTime,
            end_time: endTime,
            title: newTitle,
            notes: newDesc,
            google_meet_url: newMeetUrl,
            attendees: newAttendees,
            external_updated_at: ev.updated || null,
            google_calendar_synced: true,
            // external_event_id / google_calendar_event_id を常にセットする
            // (syncShiftToCalendar の update が webhook 到着後になるレースを塞ぐ)
            external_event_id: ev.id,
            google_calendar_event_id: ev.id,
            updated_at: new Date().toISOString(),
          }
          await admin
            .from('shifts')
            .update(updatePayload)
            .eq('id', canviShift.id)
          result.changed += 1
        } else {
          // 変更なしでも external_event_id が未設定なら埋める（重複防止の要）
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin.from('shifts') as any)
            .update({ external_event_id: ev.id, google_calendar_event_id: ev.id })
            .eq('id', canviShift.id)
            .is('external_event_id', null)
        }
        return
      }
      // 旧互換: 他の Canvi ユーザー organizer
      const organizer = (ev.organizerEmail || '').toLowerCase()
      if (organizer && organizer !== myEmail && canviEmailSet.has(organizer)) return
      // 終日 or 時刻なし → スキップ
      if (ev.isAllDay || !ev.start || !ev.end) return

      const startDate = new Date(ev.start)
      const endDate = new Date(ev.end)
      const shiftDate = toJstDateStr(startDate)
      const startTime = toJstTimeStr(startDate)
      const endTime = toJstTimeStr(endDate)

      // 既に昇格済み shifts（source='google_calendar'）なら UPDATE
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: promotedList } = await (admin.from('shifts') as any)
        .select('id, source, shift_date, start_time, end_time, title, notes, google_meet_url, external_updated_at, attendees')
        .eq('staff_id', staffId)
        .or(`external_event_id.eq.${ev.id},google_calendar_event_id.eq.${ev.id}`)
        .is('deleted_at', null)
        .limit(1) as { data: Array<{ id: string; source: string | null; shift_date: string; start_time: string; end_time: string; title: string | null; notes: string | null; google_meet_url: string | null; external_updated_at: string | null; attendees: Array<{ email: string; name?: string }> | null }> | null }

      if (promotedList && promotedList[0]) {
        const promoted = promotedList[0]
        if (promoted.source !== 'google_calendar') return
        const curStart = (promoted.start_time || '').slice(0, 5)
        const curEnd = (promoted.end_time || '').slice(0, 5)
        const newTitle = ev.summary || null
        const newDesc = ev.description || null
        const newMeetUrl = ev.meetUrl || null
        const newAttendees = (ev.attendees || [])
          .filter(a => !a.organizer)
          .map(a => ({ email: a.email, name: a.displayName || undefined }))
        const cleanNotes = promoted.notes && promoted.notes.startsWith('gcal:') ? null : promoted.notes
        const changed =
          promoted.shift_date !== shiftDate ||
          curStart !== startTime ||
          curEnd !== endTime ||
          (promoted.title || null) !== newTitle ||
          cleanNotes !== newDesc ||
          (promoted.google_meet_url || null) !== newMeetUrl ||
          JSON.stringify(promoted.attendees || []) !== JSON.stringify(newAttendees) ||
          (ev.updated && promoted.external_updated_at !== ev.updated)
        if (changed) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updatePayload: any = {
            shift_date: shiftDate,
            start_time: startTime,
            end_time: endTime,
            title: newTitle,
            notes: newDesc,
            google_meet_url: newMeetUrl,
            attendees: newAttendees,
            external_updated_at: ev.updated || null,
            google_calendar_synced: true,
            updated_at: new Date().toISOString(),
          }
          await admin
            .from('shifts')
            .update(updatePayload)
            .eq('id', promoted.id)
          result.changed += 1
        }
        return
      }

      // pending_events の UPSERT
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pendingList } = await (admin as any)
        .from('gcal_pending_events')
        .select('id, event_date, start_time, end_time, excluded')
        .eq('staff_id', staffId)
        .eq('external_event_id', ev.id)
        .limit(1) as { data: Array<{ id: string; event_date: string; start_time: string; end_time: string; excluded: boolean }> | null }

      if (pendingList && pendingList[0]) {
        const pending = pendingList[0]
        if (pending.excluded) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from('gcal_pending_events')
          .update({
            event_date: shiftDate,
            start_time: startTime,
            end_time: endTime,
            title: ev.summary || null,
            description: ev.description || null,
            meet_url: ev.meetUrl || null,
            external_updated_at: ev.updated || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pending.id)
        result.changed += 1
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from('gcal_pending_events').insert({
          staff_id: staffId,
          external_event_id: ev.id,
          external_calendar_id: 'primary',
          external_updated_at: ev.updated || null,
          event_date: shiftDate,
          start_time: startTime,
          end_time: endTime,
          title: ev.summary || null,
          description: ev.description || null,
          meet_url: ev.meetUrl || null,
        })
        result.changed += 1
      }
    } catch (e) {
      result.errors.push(`event_${ev.id}: ${(e as Error).message}`)
    }
  }))

  // nextSyncToken を保存（エラーハンドリング付き）
  if (listResult.nextSyncToken) {
    const nowIso = new Date().toISOString()
    try {
      if (state?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateErr } = await (admin as any)
          .from('gcal_sync_state')
          .update({
            sync_token: listResult.nextSyncToken,
            last_incremental_sync_at: nowIso,
            last_full_sync_at: result.mode === 'full' ? nowIso : undefined,
            updated_at: nowIso,
          })
          .eq('id', state.id)
        if (updateErr) {
          console.error('[gcal-sync] Failed to update sync_state:', updateErr)
          result.errors.push(`sync_state_update: ${updateErr.message}`)
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertErr } = await (admin as any).from('gcal_sync_state').insert({
          staff_id: staffId,
          user_id: userId,
          calendar_id: 'primary',
          sync_token: listResult.nextSyncToken,
          last_incremental_sync_at: nowIso,
          last_full_sync_at: result.mode === 'full' ? nowIso : null,
        })
        if (insertErr) {
          console.error('[gcal-sync] Failed to insert sync_state:', insertErr)
          result.errors.push(`sync_state_insert: ${insertErr.message}`)
        } else {
          console.log(`[gcal-sync] Saved syncToken for staff=${staffId}`)
        }
      }
    } catch (e) {
      console.error('[gcal-sync] sync_state save exception:', e)
      result.errors.push(`sync_state_exception: ${(e as Error).message}`)
    }
  } else {
    console.warn(`[gcal-sync] No nextSyncToken returned (mode=${result.mode}, events=${listResult.events.length})`)
  }

  return result
}
