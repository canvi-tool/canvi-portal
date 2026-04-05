import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staff_id')
    const projectId = searchParams.get('project_id')
    const yearMonth = searchParams.get('year_month') // e.g. "2026-04"

    if (!staffId || !projectId || !yearMonth) {
      return NextResponse.json({ error: 'staff_id, project_id, year_month are required' }, { status: 400 })
    }

    // Calculate date range for the month
    const [year, month] = yearMonth.split('-').map(Number)
    const startDate = `${yearMonth}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

    // Fetch all daily reports for this staff+project+month
    const { data: reports, error } = await supabase
      .from('work_reports')
      .select('custom_fields, report_type')
      .eq('staff_id', staffId)
      .eq('project_id', projectId)
      .gte('report_date', startDate)
      .lte('report_date', endDate)
      .is('deleted_at', null)
      .in('status', ['submitted', 'approved'])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Aggregate KPI totals
    let total_calls = 0
    let total_call_targets = 0
    let total_contacts = 0
    let total_appointments = 0
    let total_received = 0
    let total_completed = 0
    let total_escalations = 0

    for (const report of (reports || [])) {
      const cf = (report.custom_fields as Record<string, unknown>) || {}
      // Outbound
      total_calls += Number(cf.daily_call_count_actual) || 0
      total_call_targets += Number(cf.daily_call_count_target) || 0
      total_contacts += Number(cf.daily_contact_count) || 0
      total_appointments += Number(cf.daily_appointment_count) || 0
      // Inbound
      total_received += Number(cf.daily_received_count) || 0
      total_completed += Number(cf.daily_completed_count) || 0
      total_escalations += Number(cf.daily_escalation_count) || 0
    }

    return NextResponse.json({
      total_calls,
      total_call_targets,
      total_contacts,
      total_appointments,
      total_received,
      total_completed,
      total_escalations,
      report_count: (reports || []).length,
    })
  } catch (error) {
    console.error('GET /api/reports/daily/monthly-totals error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
