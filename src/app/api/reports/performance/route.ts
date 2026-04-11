import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { performanceReportFormSchema } from '@/lib/validations/report'
import { getProjectAccess } from '@/lib/auth/project-access'

export async function GET(request: NextRequest) {
  try {
    const { user, allowedProjectIds } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // アサインなし → 空配列を返す
    if (allowedProjectIds !== null && allowedProjectIds.length === 0) {
      return NextResponse.json([])
    }

    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const yearMonth = searchParams.get('year_month')
    const staffId = searchParams.get('staff_id')
    const projectId = searchParams.get('project_id')
    const status = searchParams.get('status')

    let query = supabase
      .from('performance_reports')
      .select('*, staff:staff_id(id, last_name, first_name), project:project_id(id, name)')
      .order('period_start', { ascending: false })
      .order('created_at', { ascending: false })

    // オーナー以外はアサイン済みプロジェクトの業務実績のみ
    if (allowedProjectIds) {
      query = query.in('project_id', allowedProjectIds)
    }

    if (yearMonth) {
      // Filter by period_start matching the given YYYY-MM
      query = query.gte('period_start', `${yearMonth}-01`).lt('period_start', `${yearMonth}-32`)
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
      staff_name: (() => { const s = report.staff as { last_name?: string; first_name?: string } | null; return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : '' })(),
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
    const { searchParams } = new URL(request.url)
    const isDraft = searchParams.get('draft') === '1'
    const targetStatus = isDraft ? 'draft' : 'submitted'

    const parsed = performanceReportFormSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Derive period_start / period_end from year_month
    const periodStart = `${parsed.data.year_month}-01`
    const periodEndDate = new Date(
      Number(parsed.data.year_month.slice(0, 4)),
      Number(parsed.data.year_month.slice(5, 7)),
      0
    )
    const periodEnd = periodEndDate.toISOString().slice(0, 10)

    // Check for duplicate
    const { data: existing } = await supabase
      .from('performance_reports')
      .select('id, status')
      .eq('staff_id', parsed.data.staff_id)
      .eq('period_start', periodStart)
      .maybeSingle()

    if (existing && existing.status === 'approved') {
      return NextResponse.json(
        { error: '承認済みの月次レポートは編集できません' },
        { status: 400 }
      )
    }

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('performance_reports')
        .update({
          project_id: parsed.data.project_id || null,
          summary: {
            call_count: parsed.data.call_count,
            appointment_count: parsed.data.appointment_count,
            other_counts: parsed.data.other_counts || {},
          },
          notes: parsed.data.notes || null,
          status: targetStatus,
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
        period_start: periodStart,
        period_end: periodEnd,
        period_type: 'monthly',
        summary: {
          call_count: parsed.data.call_count,
          appointment_count: parsed.data.appointment_count,
          other_counts: parsed.data.other_counts || {},
        },
        status: targetStatus,
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
