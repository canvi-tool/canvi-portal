import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { shiftFormSchema } from '@/lib/validations/shift'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const staffId = searchParams.get('staff_id')
    const projectId = searchParams.get('project_id')

    let query = supabase
      .from('shifts')
      .select('*, staff:staff_id(id, full_name), project:project_id(id, name)')
      .order('date', { ascending: false })
      .order('start_time', { ascending: true })

    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }
    if (staffId) {
      query = query.eq('staff_id', staffId)
    }
    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = (data || []).map((shift) => {
      let actualHours = 0
      if (shift.start_time && shift.end_time) {
        const [sh, sm] = shift.start_time.split(':').map(Number)
        const [eh, em] = shift.end_time.split(':').map(Number)
        const startMinutes = sh * 60 + sm
        const endMinutes = eh * 60 + em
        const workedMinutes = endMinutes - startMinutes - (shift.break_minutes || 0)
        actualHours = Math.max(0, workedMinutes / 60)
      }

      return {
        ...shift,
        staff_name: (shift.staff as { full_name?: string } | null)?.full_name || '',
        project_name: (shift.project as { name?: string } | null)?.name || '',
        actual_hours: Math.round(actualHours * 100) / 100,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/shifts error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
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
      .insert({
        staff_id: parsed.data.staff_id,
        project_id: parsed.data.project_id || null,
        date: parsed.data.date,
        start_time: parsed.data.start_time || null,
        end_time: parsed.data.end_time || null,
        break_minutes: parsed.data.break_minutes,
        shift_type: parsed.data.shift_type || null,
        notes: parsed.data.notes || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/shifts error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
