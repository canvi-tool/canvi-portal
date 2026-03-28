import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { assignmentFormSchema } from '@/lib/validations/assignment'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('project_assignments')
      .select(`
        *,
        staff (*),
        compensation_rules (*)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('GET /api/projects/[id]/assignments error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const parsed = assignmentFormSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Check for duplicate assignment
    const { data: existing } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('project_id', projectId)
      .eq('staff_id', parsed.data.staff_id)
      .in('status', ['pending', 'active'])
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'このスタッフは既にこのプロジェクトにアサインされています' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('project_assignments')
      .insert({
        project_id: projectId,
        staff_id: parsed.data.staff_id,
        role: parsed.data.role || null,
        status: parsed.data.status,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date || null,
      })
      .select(`
        *,
        staff (*),
        compensation_rules (*)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects/[id]/assignments error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
