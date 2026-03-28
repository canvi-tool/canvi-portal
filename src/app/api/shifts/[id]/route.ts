import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { shiftFormSchema } from '@/lib/validations/shift'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = params

    const { data, error } = await supabase
      .from('shifts')
      .select('*, staff:staff_id(id, full_name), project:project_id(id, name)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let actualHours = 0
    if (data.start_time && data.end_time) {
      const [sh, sm] = data.start_time.split(':').map(Number)
      const [eh, em] = data.end_time.split(':').map(Number)
      const startMinutes = sh * 60 + sm
      const endMinutes = eh * 60 + em
      const workedMinutes = endMinutes - startMinutes - (data.break_minutes || 0)
      actualHours = Math.max(0, workedMinutes / 60)
    }

    return NextResponse.json({
      ...data,
      staff_name: (data.staff as { full_name?: string } | null)?.full_name || '',
      project_name: (data.project as { name?: string } | null)?.name || '',
      actual_hours: Math.round(actualHours * 100) / 100,
    })
  } catch (error) {
    console.error('GET /api/shifts/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = params
    const body = await request.json()

    const parsed = shiftFormSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('shifts')
      .update({
        staff_id: parsed.data.staff_id,
        project_id: parsed.data.project_id || null,
        date: parsed.data.date,
        start_time: parsed.data.start_time || null,
        end_time: parsed.data.end_time || null,
        break_minutes: parsed.data.break_minutes,
        shift_type: parsed.data.shift_type || null,
        notes: parsed.data.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
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
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = params

    const { error } = await supabase.from('shifts').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/shifts/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
