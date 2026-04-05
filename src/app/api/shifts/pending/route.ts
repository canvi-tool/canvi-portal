import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET /api/shifts/pending - 承認待ちシフト一覧 (PM/admin用)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('shifts')
      .select('*, staff:staff_id(id, last_name, first_name), project:project_id(id, name, shift_approval_mode)', { count: 'exact' })
      .eq('status', 'SUBMITTED')
      .is('deleted_at', null)
      .order('submitted_at', { ascending: true })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = (data || []).map((shift) => ({
      ...shift,
      staff_name: (() => { const s = shift.staff as { last_name?: string; first_name?: string } | null; return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : '' })(),
      project_name: (shift.project as { name?: string } | null)?.name || '',
      project_shift_approval_mode: (shift.project as { shift_approval_mode?: string } | null)?.shift_approval_mode || 'AUTO',
    }))

    return NextResponse.json({ data: result, total: count || 0 })
  } catch (error) {
    console.error('GET /api/shifts/pending error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
