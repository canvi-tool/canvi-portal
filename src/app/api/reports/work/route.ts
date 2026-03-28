import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { workReportFormSchema } from '@/lib/validations/report'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const staffId = searchParams.get('staff_id')
    const projectId = searchParams.get('project_id')
    const status = searchParams.get('status')

    let query = supabase
      .from('work_reports')
      .select('*, staff:staff_id(id, full_name), project:project_id(id, name)')
      .order('year_month', { ascending: false })
      .order('created_at', { ascending: false })

    if (startDate) {
      query = query.gte('year_month', startDate)
    }
    if (endDate) {
      query = query.lte('year_month', endDate)
    }
    if (staffId) {
      query = query.eq('staff_id', staffId)
    }
    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = (data || []).map((report) => ({
      ...report,
      staff_name: (report.staff as { full_name?: string } | null)?.full_name || '',
      project_name: (report.project as { name?: string } | null)?.name || '',
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/reports/work error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const parsed = workReportFormSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Shift cross-check: compare total_hours with actual shift hours
    let shiftWarning: string | null = null
    if (parsed.data.year_month && parsed.data.staff_id) {
      const yearMonth = parsed.data.year_month
      const startDate = `${yearMonth}-01`
      const [y, m] = yearMonth.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

      const { data: shifts } = await supabase
        .from('shifts')
        .select('start_time, end_time')
        .eq('staff_id', parsed.data.staff_id)
        .gte('date', startDate)
        .lte('date', endDate)

      if (shifts && shifts.length > 0) {
        let totalShiftHours = 0
        for (const shift of shifts) {
          if (shift.start_time && shift.end_time) {
            const [sh, sm] = shift.start_time.split(':').map(Number)
            const [eh, em] = shift.end_time.split(':').map(Number)
            const minutes = eh * 60 + em - (sh * 60 + sm)
            totalShiftHours += Math.max(0, minutes / 60)
          }
        }

        totalShiftHours = Math.round(totalShiftHours * 100) / 100
        const reportedHours = parsed.data.total_hours

        if (Math.abs(totalShiftHours - reportedHours) > 1) {
          shiftWarning = `シフト時間 (${totalShiftHours}h) と報告時間 (${reportedHours}h) に差異があります`
        }
      }
    }

    const { data, error } = await supabase
      .from('work_reports')
      .insert({
        staff_id: parsed.data.staff_id,
        project_id: parsed.data.project_id || null,
        year_month: parsed.data.year_month,
        total_hours: parsed.data.total_hours,
        overtime_hours: parsed.data.overtime_hours,
        working_days: parsed.data.working_days,
        standby_hours: parsed.data.standby_hours,
        standby_days: parsed.data.standby_days,
        status: 'draft',
        notes: parsed.data.notes || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { ...data, shift_warning: shiftWarning },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/reports/work error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
