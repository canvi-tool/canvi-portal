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
    const isManager = roleNames.some((n) => ['admin', 'owner', 'manager'].includes(n))

    const staffIdsParam = searchParams.get('staff_id')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = (admin as any).from('gcal_pending_events').select('*').eq('excluded', false)
    if (staffIdsParam) {
      const ids = staffIdsParam.split(',').filter(Boolean)
      if (ids.length > 0) query = query.in('staff_id', ids)
    }
    if (!isManager) {
      const { data: staffRec } = await admin
        .from('staff')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      if (!staffRec) return NextResponse.json([])
      query = query.eq('staff_id', (staffRec as { id: string }).id)
    }
    if (startDate) query = query.gte('event_date', startDate)
    if (endDate) query = query.lte('event_date', endDate)
    query = query.order('event_date', { ascending: true }).order('start_time', { ascending: true })

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('GET /api/shifts/gcal-pending error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
