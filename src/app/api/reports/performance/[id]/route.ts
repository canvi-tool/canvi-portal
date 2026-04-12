import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'

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
    const derivedYearMonth = data.period_start?.slice(0, 7) ?? null
    let workReportSummary = null
    if (data.staff_id && derivedYearMonth) {
      const { data: workReport } = await supabase
        .from('work_reports')
        .select('total_hours, overtime_hours, working_days, standby_hours')
        .eq('staff_id', data.staff_id)
        .eq('year_month', derivedYearMonth)
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

// ---- DELETE: 論理削除（オーナーのみ） ----
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    if (!isOwner(user)) {
      return NextResponse.json({ error: 'オーナーのみ削除可能です' }, { status: 403 })
    }

    const { id } = params
    const supabase = await createServerSupabaseClient()

    // 既存レコード確認
    const { data: existing, error: fetchError } = await supabase
      .from('performance_reports')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: '月次報告が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!existing) {
      return NextResponse.json({ error: '月次報告が見つかりません' }, { status: 404 })
    }

    const { error } = await supabase
      .from('performance_reports')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
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

// ---- PATCH: 承認（オーナーのみ） ----
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    if (!isOwner(user)) {
      return NextResponse.json({ error: 'オーナーのみ承認可能です' }, { status: 403 })
    }

    const { id } = params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const newStatus = body.status
    if (!['approved', 'rejected'].includes(newStatus)) {
      return NextResponse.json({ error: '無効なステータスです' }, { status: 400 })
    }

    // 既存レコード確認
    const { data: existing, error: fetchError } = await supabase
      .from('performance_reports')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: '月次報告が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!existing) {
      return NextResponse.json({ error: '月次報告が見つかりません' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: now,
    }

    if (newStatus === 'approved') {
      updateData.approved_at = now
      updateData.approved_by = user.id
    }

    if (body.comment) {
      updateData.notes = body.comment
    }

    const { data, error } = await supabase
      .from('performance_reports')
      .update(updateData)
      .eq('id', id)
      .select('*, staff:staff_id(id, last_name, first_name), project:project_id(id, name)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PATCH /api/reports/performance/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
