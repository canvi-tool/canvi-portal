import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getProjectAccess } from '@/lib/auth/project-access'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    const supabase = await createServerSupabaseClient()
    const { id } = params

    const { data: existing, error: fetchError } = await supabase
      .from('performance_reports')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: '月次レポートが見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (existing.status === 'approved') {
      return NextResponse.json(
        { error: '承認済みの月次レポートは削除できません' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('performance_reports')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/reports/performance/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = params

    const { data, error } = await supabase
      .from('performance_reports')
      .select('*, staff:staff_id(id, last_name, first_name, email), project:project_id(id, name)')
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
      staff_name: (() => { const s = data.staff as { last_name?: string; first_name?: string } | null; return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : '' })(),
      project_name: (data.project as { name?: string } | null)?.name || '',
      work_report_summary: workReportSummary,
      kpi_targets: kpiTargets,
    })
  } catch (error) {
    console.error('GET /api/reports/performance/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
