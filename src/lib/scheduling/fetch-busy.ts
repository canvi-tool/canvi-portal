import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'
import type { BusyInterval } from './compute-slots'

/**
 * 指定ユーザー群の指定期間の busy 時間を返す。
 * Googleカレンダー予定 + Canviシフトをマージ。
 */
export async function fetchMemberBusy(
  userIds: string[],
  dateRangeStart: string,
  dateRangeEnd: string
): Promise<Record<string, BusyInterval[]>> {
  const admin = createAdminClient()
  const memberBusy: Record<string, BusyInterval[]> = {}
  for (const uid of userIds) memberBusy[uid] = []

  const timeMin = `${dateRangeStart}T00:00:00+09:00`
  const timeMax = `${dateRangeEnd}T23:59:59+09:00`

  const gcalPromises = userIds.map(async (uid) => {
    const token = await getValidTokenForUser(uid)
    if (!token) return { id: uid, busy: [] as BusyInterval[] }
    try {
      const client = await GoogleCalendarClient.create(token.accessToken, token.refreshToken || undefined)
      const busy = await client.getBusyFromEvents({ timeMin, timeMax })
      return { id: uid, busy: busy.map(b => ({ start: b.start, end: b.end })) }
    } catch {
      return { id: uid, busy: [] as BusyInterval[] }
    }
  })

  const gcalResults = await Promise.all(gcalPromises)
  for (const r of gcalResults) {
    memberBusy[r.id] = (memberBusy[r.id] || []).concat(r.busy)
  }

  // シフトもbusy扱い
  const { data: shifts } = await admin
    .from('shifts')
    .select('shift_date, start_time, end_time, staff!inner(user_id)')
    .gte('shift_date', dateRangeStart)
    .lte('shift_date', dateRangeEnd)
    .is('deleted_at', null)
    .in('status', ['APPROVED', 'SUBMITTED'])

  for (const s of (shifts || [])) {
    const staffData = s.staff as unknown as { user_id: string }
    const uid = staffData.user_id
    if (userIds.includes(uid)) {
      if (!memberBusy[uid]) memberBusy[uid] = []
      memberBusy[uid].push({
        start: `${s.shift_date}T${s.start_time}+09:00`,
        end: `${s.shift_date}T${s.end_time}+09:00`,
      })
    }
  }

  return memberBusy
}
