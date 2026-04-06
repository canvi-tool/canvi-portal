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
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }

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

  for (const ev of events) {
    // Canvi発のイベント → スキップ
    if (ev.canviShiftId) {
      result.skipped += 1
      continue
    }
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

    // 既存判定: external_event_id OR 旧来の google_calendar_event_id を両方チェック
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingList } = await admin
      .from('shifts')
      .select('id, shift_date, start_time, end_time, external_updated_at')
      .eq('staff_id', staffId)
      .or(`external_event_id.eq.${ev.id},google_calendar_event_id.eq.${ev.id}`)
      .is('deleted_at', null)
      .limit(1) as { data: { id: string; shift_date: string; start_time: string; end_time: string; external_updated_at: string | null }[] | null }
    const existing = existingList && existingList[0] ? existingList[0] : null

    if (existing) {
      // 差分があればUPDATE
      const changed =
        existing.shift_date !== shiftDate ||
        existing.start_time.slice(0, 5) !== startTime ||
        existing.end_time.slice(0, 5) !== endTime
      if (changed) {
        const { error } = await admin
          .from('shifts')
          .update({
            shift_date: shiftDate,
            start_time: startTime,
            end_time: endTime,
            external_updated_at: ev.updated || null,
          })
          .eq('id', existing.id)
        if (error) result.errors.push(`UPDATE失敗 ${ev.id}: ${error.message}`)
        else result.updated += 1
      } else {
        result.skipped += 1
      }
      continue
    }

    // 新規INSERT (supabase型がマイグレーション未反映のためキャスト)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertPayload: any = {
      staff_id: staffId,
      project_id: null,
      shift_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      shift_type: 'WORK',
      status: 'APPROVED',
      notes: ev.summary,
      source: 'google_calendar',
      external_event_id: ev.id,
      external_calendar_id: 'primary',
      external_updated_at: ev.updated || null,
      needs_project_assignment: true,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from('shifts') as any).insert(insertPayload)
    if (error) result.errors.push(`INSERT失敗 ${ev.id}: ${error.message}`)
    else result.created += 1
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
