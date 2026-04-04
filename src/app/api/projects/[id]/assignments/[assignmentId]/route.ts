import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { assignmentFormSchema } from '@/lib/validations/assignment'

interface RouteParams {
  params: Promise<{ id: string; assignmentId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { assignmentId } = await params
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('project_assignments')
      .select(`
        *,
        staff (*),
        compensation_rules (*)
      `)
      .eq('id', assignmentId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'アサインが見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET assignment error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { assignmentId } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const parsed = assignmentFormSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (parsed.data.role_title !== undefined) updateData.role_title = parsed.data.role_title || null
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status
    if (parsed.data.start_date !== undefined) updateData.start_date = parsed.data.start_date
    if (parsed.data.end_date !== undefined) updateData.end_date = parsed.data.end_date || null

    const { data, error } = await supabase
      .from('project_assignments')
      .update(updateData)
      .eq('id', assignmentId)
      .select(`
        *,
        staff (*),
        compensation_rules (*)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PUT assignment error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { assignmentId } = await params
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('project_assignments')
      .delete()
      .eq('id', assignmentId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE assignment error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
