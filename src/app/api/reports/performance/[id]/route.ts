import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = params

    const { data, error } = await supabase
      .from('performance_reports')
      .select('*, staff:staff_id(id, full_name, email), project:project_id(id, name)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '業務実績が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch work report for the same period to get hours data
    let workReportSummary = null
    if (data.staff_id && data.year_month) {
      const { data: workReport } = await supabase
        .from('work_reports')
        .select('total_hours, overtime_hours, working_days, standby_hours')
        .eq('staff_id', data.staff_id)
        .eq('year_month', data.year_month)
        .maybeSingle()

      if (workReport) {
        workReportSummary = workReport
      }
    }

    // Fetch compensation rules for KPI targets
    let kpiTargets = null
    if (data.staff_id && data.project_id) {
      const { data: assignment } = await supabase
        .from('project_assignments')
        .select('id')
        .eq('staff_id', data.staff_id)
        .eq('project_id', data.project_id)
        .eq('status', 'active')
        .maybeSingle()

      if (assignment) {
        const { data: rules } = await supabase
          .from('compensation_rules')
          .select('*')
          .eq('assignment_id', assignment.id)
          .eq('is_active', true)

        if (rules) {
          kpiTargets = rules.map((rule) => ({
            rule_type: rule.rule_type,
            name: rule.name,
            params: rule.params,
          }))
        }
      }
    }

    return NextResponse.json({
      ...data,
      staff_name: (data.staff as { full_name?: string } | null)?.full_name || '',
      project_name: (data.project as { name?: string } | null)?.name || '',
      work_report_summary: workReportSummary,
      kpi_targets: kpiTargets,
    })
  } catch (error) {
    console.error('GET /api/reports/performance/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
