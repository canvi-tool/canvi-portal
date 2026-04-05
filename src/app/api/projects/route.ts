import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { projectFormSchema } from '@/lib/validations/project'
import { getProjectAccess } from '@/lib/auth/project-access'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'

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
    const search = searchParams.get('search')
    const status = searchParams.get('status')

    let query = supabase.from('projects').select('*').order('project_code', { ascending: true })

    // オーナー以外はアサイン済みプロジェクトのみにフィルタ
    if (allowedProjectIds) {
      query = query.in('id', allowedProjectIds)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,client_name.ilike.%${search}%,project_code.ilike.%${search}%`)
    }

    if (status && status !== 'all') {
      // 新旧ステータス互換: UIが新値を送っても旧DB値にマッピング
      const statusMap: Record<string, string[]> = {
        proposing: ['proposing', 'planning'],
        active: ['active'],
        ended: ['ended', 'completed', 'archived', 'paused'],
      }
      const mappedStatuses = statusMap[status]
      if (mappedStatuses && mappedStatuses.length > 1) {
        query = query.in('status', mappedStatuses)
      } else {
        query = query.eq('status', status)
      }
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch assignment counts for each project
    const projectIds = (data || []).map((p) => p.id)
    const assignmentCounts: Record<string, number> = {}
    const assignmentNames: Record<string, string[]> = {}

    if (projectIds.length > 0) {
      const { data: assignments } = await supabase
        .from('project_assignments')
        .select('project_id, staff:staff_id(last_name, first_name)')
        .in('project_id', projectIds)
        .is('deleted_at', null)
        .in('status', ['proposed', 'confirmed', 'in_progress'])

      if (assignments) {
        for (const a of assignments) {
          assignmentCounts[a.project_id] = (assignmentCounts[a.project_id] || 0) + 1
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const s = (a as any).staff as { last_name?: string; first_name?: string } | null
          const name = s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : undefined
          if (name) {
            if (!assignmentNames[a.project_id]) assignmentNames[a.project_id] = []
            assignmentNames[a.project_id].push(name)
          }
        }
      }
    }

    const result = (data || []).map((p) => ({
      ...p,
      assignment_count: assignmentCounts[p.id] || 0,
      assignment_names: assignmentNames[p.id] || [],
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/projects error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || !isOwner(currentUser)) {
      return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })
    }

    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const parsed = projectFormSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { project_code, project_type, project_number, google_calendar_id, client_id, slack_channel_id, slack_channel_name, shift_approval_mode, ...rest } = parsed.data

    // 新ステータス→旧DB enum値マッピング（マイグレーション前の互換対応）
    const STATUS_TO_DB: Record<string, string> = {
      proposing: 'planning',
      active: 'active',
      ended: 'completed',
    }
    const dbStatus = STATUS_TO_DB[rest.status] || rest.status

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('projects')
      .insert({
        project_code: project_code || `${project_type}-${project_number}`,
        project_type,
        project_number,
        name: rest.name,
        description: rest.description || null,
        status: dbStatus,
        client_id: client_id || null,
        client_name: rest.client_name || null,
        start_date: rest.start_date || null,
        end_date: rest.end_date || null,
        slack_channel_id: slack_channel_id || null,
        slack_channel_name: slack_channel_name || null,
        shift_approval_mode: shift_approval_mode || 'AUTO',
        custom_fields: {
          google_calendar_id: google_calendar_id || null,
        },
        created_by: user?.id || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505' && error.message.includes('projects_project_code_key')) {
        return NextResponse.json(
          { error: `PJコード「${project_code || `${project_type}-${project_number}`}」は既に使用されています` },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
