import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarClient } from '@/lib/integrations/google-calendar'
import { getValidTokenForUser } from '@/lib/integrations/google-token'

/**
 * GET /api/calendar/availability
 * 指定メンバーの空き時間を算出
 * Query: user_ids (カンマ区切り), time_min, time_max
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userIds = searchParams.get('user_ids')?.split(',').filter(Boolean) || []
    const timeMin = searchParams.get('time_min')
    const timeMax = searchParams.get('time_max')

    if (!userIds.length || !timeMin || !timeMax) {
      return NextResponse.json({ error: 'user_ids, time_min, time_max は必須です' }, { status: 400 })
    }

    const admin = createAdminClient()

    // ユーザー情報取得（email + Googleトークン）
    const { data: users, error: usersError } = await admin
      .from('users')
      .select('id, email, display_name, google_access_token, google_refresh_token')
      .in('id', userIds)

    if (usersError) {
      console.error('Users query error:', usersError)
      // google_access_tokenカラムが未追加の場合のフォールバック
      const { data: fallbackUsers } = await admin
        .from('users')
        .select('id, email, display_name')
        .in('id', userIds)
      if (fallbackUsers) {
        const membersResult = fallbackUsers.map(u => ({
          id: u.id,
          email: u.email,
          displayName: u.display_name,
          busy: [],
        }))
        return NextResponse.json({ members: membersResult, timeMin, timeMax })
      }
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    // 各ユーザーのシフトを取得
    const timeMinDate = timeMin.split('T')[0]
    const timeMaxDate = timeMax.split('T')[0]

    const { data: shifts } = await admin
      .from('shifts')
      .select('staff_id, shift_date, start_time, end_time, shift_type, staff!inner(user_id)')
      .gte('shift_date', timeMinDate)
      .lte('shift_date', timeMaxDate)
      .is('deleted_at', null)
      .in('status', ['APPROVED', 'SUBMITTED'])

    // Googleカレンダーからbusy時間を取得
    // 各メンバーの自分のトークンで自分のカレンダーを取得
    const googleBusy: Record<string, Array<{ start: string; end: string }>> = {}

    const busyPromises = users.map(async (u) => {
      const token = await getValidTokenForUser(u.id)
      if (!token) return { email: u.email, busy: [] as Array<{ start: string; end: string }> }

      try {
        const client = new GoogleCalendarClient(token.accessToken, token.refreshToken || undefined)
        const result = await client.getFreeBusy({
          emails: [u.email],
          timeMin,
          timeMax,
        })
        return { email: u.email, busy: result[u.email] || [] }
      } catch (e) {
        console.warn(`FreeBusy API failed for ${u.email}:`, e)
        return { email: u.email, busy: [] as Array<{ start: string; end: string }> }
      }
    })

    const busyResults = await Promise.all(busyPromises)
    for (const r of busyResults) {
      googleBusy[r.email] = r.busy
    }

    // シフトをユーザーIDごとにグループ化（O(n)でMap作成）
    const shiftsByUserId = new Map<string, typeof shifts>()
    for (const s of (shifts || [])) {
      const staffData = s.staff as unknown as { user_id: string }
      const uid = staffData.user_id
      if (!shiftsByUserId.has(uid)) {
        shiftsByUserId.set(uid, [])
      }
      shiftsByUserId.get(uid)!.push(s)
    }

    // ユーザーごとのbusy時間を統合
    const busyByUser: Record<string, Array<{ start: string; end: string; source: 'shift' | 'google' }>> = {}

    for (const u of users) {
      const userId = u.id
      busyByUser[userId] = []

      // Googleカレンダーのbusy時間
      const gcalBusy = googleBusy[u.email] || []
      for (const b of gcalBusy) {
        busyByUser[userId].push({ start: b.start, end: b.end, source: 'google' })
      }

      // シフトをbusy時間として追加（Mapルックアップ O(1)）
      const userShifts = shiftsByUserId.get(userId) || []

      for (const shift of userShifts) {
        busyByUser[userId].push({
          start: `${shift.shift_date}T${shift.start_time}:00+09:00`,
          end: `${shift.shift_date}T${shift.end_time}:00+09:00`,
          source: 'shift',
        })
      }
    }

    // 空き時間算出（全員が空いている時間帯）
    const members = users.map(u => ({
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      busy: busyByUser[u.id] || [],
    }))

    return NextResponse.json({
      members,
      timeMin,
      timeMax,
    })
  } catch (error) {
    console.error('GET /api/calendar/availability error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
