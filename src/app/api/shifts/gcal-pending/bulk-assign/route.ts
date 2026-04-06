/**
 * POST /api/shifts/gcal-pending/bulk-assign
 * PJ未割当のGCalイベントを一括で shifts に昇格
 * Body: { ids: string[], project_id: string, shift_type?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const ids = Array.isArray(body.ids) ? (body.ids as string[]).filter(Boolean) : []
    const projectId = body.project_id as string | undefined
    const shiftType = (body.shift_type as string | undefined) || 'WORK'
    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids は必須です' }, { status: 400 })
    }
    if (!projectId) {
      return NextResponse.json({ error: 'project_id は必須です' }, { status: 400 })
    }

    const admin = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendings, error: pErr } = await (admin as any).from('gcal_pending_events')
      .select('*')
      .in('id', ids)
    if (pErr) {
      return NextResponse.json({ error: `取得失敗: ${pErr.message}` }, { status: 500 })
    }
    if (!pendings || pendings.length === 0) {
      return NextResponse.json({ error: '該当イベントが見つかりません' }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertPayload = (pendings as any[]).map((p) => ({
      created_by: user.id,
      staff_id: p.staff_id,
      project_id: projectId,
      shift_date: p.event_date,
      start_time: p.start_time,
      end_time: p.end_time,
      shift_type: shiftType,
      status: 'APPROVED',
      notes: p.title || null,
      source: 'google_calendar',
      external_event_id: p.external_event_id,
      external_calendar_id: p.external_calendar_id,
      external_updated_at: p.external_updated_at,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error: iErr } = await (admin.from('shifts') as any)
      .insert(insertPayload)
      .select()
    if (iErr) {
      return NextResponse.json({ error: `INSERT失敗: ${iErr.message}` }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignedIds = (pendings as any[]).map((p) => p.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('gcal_pending_events').delete().in('id', assignedIds)

    return NextResponse.json({ count: inserted?.length || 0, shifts: inserted })
  } catch (error) {
    console.error('POST /api/shifts/gcal-pending/bulk-assign error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
