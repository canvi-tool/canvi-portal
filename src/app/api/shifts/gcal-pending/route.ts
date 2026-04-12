/**
 * GET /api/shifts/gcal-pending
 * PJ未割当のGoogleカレンダー取込イベント一覧
 * Query: start_date, end_date
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const admin = createAdminClient()

    // 権限判定: 管理者系なら全件、そうでなければ自分のstaffのみ
    const { data: roleRows } = await admin
      .from('user_roles')
      .select('role:role_id(name)')
      .eq('user_id', user.id)
    const roleNames = (roleRows || [])
      .map((r) => (r.role as { name?: string } | null)?.name)
      .filter(Boolean) as string[]
    const isManager = roleNames.some((n) => ['admin', 'manager'].includes(n))
    const isOwnerRole = roleNames.includes('owner')

    const staffIdsParam = searchParams.get('staff_id')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = (admin as any).from('gcal_pending_events').select('*').eq('excluded', false)
    if (staffIdsParam) {
      const ids = staffIdsParam.split(',').filter(Boolean)
      if (ids.length > 0) query = query.in('staff_id', ids)
    }
    if (!isOwnerRole) {
      // 自分のstaff_id
      const { data: staffRec } = await admin
        .from('staff')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      const myStaffId = (staffRec as { id: string } | null)?.id || null
      const allowedStaffIds = new Set<string>()
      if (myStaffId) allowedStaffIds.add(myStaffId)

      if (isManager && myStaffId) {
        // 管理者: 自分のアサインPJの全スタッフを許可
        const { data: myAssigns } = await admin
          .from('project_assignments')
          .select('project_id')
          .eq('staff_id', myStaffId)
          .is('deleted_at', null)
        const myPjIds = (myAssigns || []).map((a) => a.project_id as string)
        if (myPjIds.length > 0) {
          const { data: pjAssigns } = await admin
            .from('project_assignments')
            .select('staff_id')
            .in('project_id', myPjIds)
            .is('deleted_at', null)
          for (const a of pjAssigns || []) allowedStaffIds.add(a.staff_id as string)
        }
      }

      if (allowedStaffIds.size === 0) return NextResponse.json([])
      query = query.in('staff_id', Array.from(allowedStaffIds))
    }
    if (startDate) query = query.gte('event_date', startDate)
    if (endDate) query = query.lt('event_date', endDate)
    query = query.order('event_date', { ascending: true }).order('start_time', { ascending: true })

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Server-side deduplication: exclude pending events that already have a corresponding shift
    // A pending event is considered a duplicate if its external_event_id matches
    // a shift's external_event_id or google_calendar_event_id for the same staff
    let filtered = data || []
    if (filtered.length > 0) {
      try {
        const externalIds = filtered
          .map((p: { external_event_id?: string }) => p.external_event_id)
          .filter(Boolean) as string[]
        if (externalIds.length > 0) {
          // Query shifts that match by external_event_id
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: shiftsByExternal } = await (admin as any)
            .from('shifts')
            .select('external_event_id, google_calendar_event_id')
            .in('external_event_id', externalIds) as { data: Array<{ external_event_id: string | null; google_calendar_event_id: string | null }> | null }
          // Query shifts that match by google_calendar_event_id
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: shiftsByGcal } = await (admin as any)
            .from('shifts')
            .select('external_event_id, google_calendar_event_id')
            .in('google_calendar_event_id', externalIds) as { data: Array<{ external_event_id: string | null; google_calendar_event_id: string | null }> | null }

          const matchedIds = new Set<string>()
          for (const s of shiftsByExternal || []) {
            if (s.external_event_id) matchedIds.add(s.external_event_id)
          }
          for (const s of shiftsByGcal || []) {
            if (s.google_calendar_event_id) matchedIds.add(s.google_calendar_event_id)
          }

          if (matchedIds.size > 0) {
            filtered = filtered.filter(
              (p: { external_event_id?: string }) =>
                !p.external_event_id || !matchedIds.has(p.external_event_id)
            )
          }
        }
      } catch {
        // Dedup failure is non-fatal; return unfiltered results
      }
    }

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('GET /api/shifts/gcal-pending error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
