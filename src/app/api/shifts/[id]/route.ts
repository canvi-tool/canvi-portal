import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { shiftFormSchema } from '@/lib/validations/shift'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const DEMO_SHIFT = {
  id: 'shift-001',
  staff_id: 'staff-001',
  project_id: 'proj-001',
  shift_date: '2026-03-28',
  start_time: '09:00',
  end_time: '18:00',
  status: 'APPROVED',
  notes: null,
  google_calendar_event_id: 'gcal-ev-001',
  google_calendar_synced: true,
  submitted_at: '2026-03-25T10:00:00Z',
  approved_at: '2026-03-25T11:00:00Z',
  approved_by: 'user-001',
  created_by: 'user-002',
  created_at: '2026-03-24T09:00:00Z',
  updated_at: '2026-03-25T11:00:00Z',
  deleted_at: null,
  staff_name: '田中 太郎',
  project_name: 'Webサイトリニューアル',
  approval_history: [
    {
      id: 'ah-001',
      shift_id: 'shift-001',
      action: 'APPROVE',
      comment: '問題ありません',
      previous_start_time: null,
      previous_end_time: null,
      new_start_time: null,
      new_end_time: null,
      performed_by: 'user-001',
      performed_at: '2026-03-25T11:00:00Z',
      performer_name: '山田 管理者',
    },
  ],
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    if (DEMO_MODE) {
      return NextResponse.json({ ...DEMO_SHIFT, id })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('shifts')
      .select('*, staff:staff_id(id, last_name, first_name), project:project_id(id, name)')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 承認履歴を取得
    const { data: history } = await supabase
      .from('shift_approval_history')
      .select('*, performer:performed_by(id, email)')
      .eq('shift_id', id)
      .order('performed_at', { ascending: true })

    return NextResponse.json({
      ...data,
      staff_name: (() => { const s = data.staff as { last_name?: string; first_name?: string } | null; return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : '' })(),
      project_name: (data.project as { name?: string } | null)?.name || '',
      approval_history: history || [],
    })
  } catch (error) {
    console.error('GET /api/shifts/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const body = await request.json()

    const parsed = shiftFormSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    if (DEMO_MODE) {
      return NextResponse.json({
        ...DEMO_SHIFT,
        id,
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
    }

    const supabase = await createServerSupabaseClient()

    // ステータスチェック: APPROVED済みのシフトは直接編集不可
    const { data: existing } = await supabase
      .from('shifts')
      .select('status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
    }

    if (existing.status === 'APPROVED') {
      return NextResponse.json(
        { error: '承認済みのシフトは直接編集できません。修正を申請してください。' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('shifts')
      .update({
        staff_id: parsed.data.staff_id,
        project_id: parsed.data.project_id,
        shift_date: parsed.data.shift_date,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        notes: parsed.data.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PUT /api/shifts/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    if (DEMO_MODE) {
      return NextResponse.json({ success: true })
    }

    const supabase = await createServerSupabaseClient()

    // 論理削除
    const { error } = await supabase
      .from('shifts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/shifts/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
