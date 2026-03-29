import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { workReportFormSchema, workReportApprovalSchema } from '@/lib/validations/report'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = params

    const { data, error } = await supabase
      .from('work_reports')
      .select('*, staff:staff_id(id, last_name, first_name, email), project:project_id(id, name)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '勤務報告が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch shift data for cross-check
    let shiftSummary = null
    if (data.year_month && data.staff_id) {
      const yearMonth = data.year_month
      const startDate = `${yearMonth}-01`
      const [y, m] = yearMonth.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

      const { data: shifts } = await supabase
        .from('shifts')
        .select('*')
        .eq('staff_id', data.staff_id)
        .gte('date', startDate)
        .lte('date', endDate)

      if (shifts) {
        let totalShiftHours = 0
        for (const shift of shifts) {
          if (shift.start_time && shift.end_time) {
            const [sh, sm] = shift.start_time.split(':').map(Number)
            const [eh, em] = shift.end_time.split(':').map(Number)
            const minutes = eh * 60 + em - (sh * 60 + sm)
            totalShiftHours += Math.max(0, minutes / 60)
          }
        }

        shiftSummary = {
          shift_days: shifts.length,
          shift_total_hours: Math.round(totalShiftHours * 100) / 100,
          hours_diff: Math.round((data.total_hours - totalShiftHours) * 100) / 100,
        }
      }
    }

    return NextResponse.json({
      ...data,
      staff_name: (() => { const s = data.staff as { last_name?: string; first_name?: string } | null; return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : '' })(),
      project_name: (data.project as { name?: string } | null)?.name || '',
      shift_summary: shiftSummary,
    })
  } catch (error) {
    console.error('GET /api/reports/work/[id] error:', error)
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

    const parsed = workReportFormSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('work_reports')
      .update({
        staff_id: parsed.data.staff_id,
        project_id: parsed.data.project_id || null,
        year_month: parsed.data.year_month,
        total_hours: parsed.data.total_hours,
        overtime_hours: parsed.data.overtime_hours,
        working_days: parsed.data.working_days,
        standby_hours: parsed.data.standby_hours,
        standby_days: parsed.data.standby_days,
        notes: parsed.data.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '勤務報告が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PUT /api/reports/work/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = params
    const body = await request.json()

    const parsed = workReportApprovalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const updateData: Record<string, unknown> = {
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    }

    if (parsed.data.status === 'approved') {
      updateData.approved_at = new Date().toISOString()
      updateData.approved_by = user?.id || null
    }

    const { data, error } = await supabase
      .from('work_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '勤務報告が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PATCH /api/reports/work/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
