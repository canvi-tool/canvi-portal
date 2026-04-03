import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { projectFormSchema } from '@/lib/validations/project'
import { canAccessProject } from '@/lib/auth/project-access'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { user, hasAccess } = await canAccessProject(id)
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'このプロジェクトへのアクセス権がありません' }, { status: 403 })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get assignment count
    const { count } = await supabase
      .from('project_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', id)

    return NextResponse.json({ ...data, assignment_count: count || 0 })
  } catch (error) {
    console.error('GET /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const parsed = projectFormSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { project_code, project_type, project_number, google_calendar_id, client_id, ...rest } = parsed.data

    const { data, error } = await supabase
      .from('projects')
      .update({
        project_code: project_code || `${project_type}-${project_number}`,
        project_type,
        project_number,
        name: rest.name,
        description: rest.description || null,
        status: rest.status,
        client_id: client_id || null,
        client_name: rest.client_name || null,
        start_date: rest.start_date || null,
        end_date: rest.end_date || null,
        custom_fields: {
          google_calendar_id: google_calendar_id || null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      // ユニーク制約違反（project_code重複）
      if (error.code === '23505' && error.message.includes('projects_project_code_key')) {
        return NextResponse.json(
          { error: `PJコード「${project_code || `${project_type}-${project_number}`}」は既に使用されています` },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PUT /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase.from('projects').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
