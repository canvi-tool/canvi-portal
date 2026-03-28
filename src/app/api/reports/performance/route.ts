import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { performanceReportFormSchema } from '@/lib/validations/report'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const yearMonth = searchParams.get('year_month')
    const staffId = searchParams.get('staff_id')
    const projectId = searchParams.get('project_id')
    const status = searchParams.get('status')

    let query = supabase
      .from('performance_reports')
      .select('*, staff:staff_id(id, full_name), project:project_id(id, name)')
      .order('year_month', { ascending: false })
      .order('created_at', { ascending: false })

    if (yearMonth) {
      query = query.eq('year_month', yearMonth)
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
    console.error('GET /api/reports/performance error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const parsed = performanceReportFormSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('performance_reports')
      .select('id')
      .eq('staff_id', parsed.data.staff_id)
      .eq('year_month', parsed.data.year_month)
      .maybeSingle()

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('performance_reports')
        .update({
          project_id: parsed.data.project_id || null,
          call_count: parsed.data.call_count,
          appointment_count: parsed.data.appointment_count,
          other_counts: parsed.data.other_counts || null,
          notes: parsed.data.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json(data)
    }

    const { data, error } = await supabase
      .from('performance_reports')
      .insert({
        staff_id: parsed.data.staff_id,
        project_id: parsed.data.project_id || null,
        year_month: parsed.data.year_month,
        call_count: parsed.data.call_count,
        appointment_count: parsed.data.appointment_count,
        other_counts: parsed.data.other_counts || null,
        status: 'draft',
        notes: parsed.data.notes || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/reports/performance error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
