import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { projectFormSchema } from '@/lib/validations/project'
import { canAccessProject } from '@/lib/auth/project-access'
import { syncProjectUsergroup, disableProjectUsergroup, updateProjectUsergroupName } from '@/lib/integrations/slack'

function after(fn: () => Promise<unknown>) {
  try {
    waitUntil(fn().catch((e) => console.error('[projects/[id]] after task error:', e)))
  } catch {
    fn().catch((e) => console.error('[projects/[id]] after-fallback task error:', e))
  }
}

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
      .is('deleted_at', null)

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

    const { project_code, project_type, project_number, client_id, slack_channel_id, slack_channel_name, shift_approval_mode, calendar_display_name: calDisplayName, report_type, ...rest } = parsed.data

    // 変更検知のため旧値を取得
    const { data: oldProject } = await supabase
      .from('projects')
      .select('slack_channel_id, name, status, custom_fields')
      .eq('id', id)
      .single()
    const oldSlackChannelId = oldProject?.slack_channel_id || null
    const newSlackChannelId = slack_channel_id || null
    const slackChannelChanged = oldSlackChannelId !== newSlackChannelId

    // 新ステータス→旧DB enum値マッピング（マイグレーション前の互換対応）
    const STATUS_TO_DB: Record<string, string> = {
      proposing: 'planning',
      active: 'active',
      ended: 'completed',
    }
    const dbStatus = STATUS_TO_DB[rest.status] || rest.status

    const { data, error } = await supabase
      .from('projects')
      .update({
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
        report_type: report_type || null,
        custom_fields: {
          calendar_display_name: calDisplayName || null,
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

    // slack_channel_id が変更された場合、プロジェクトユーザーグループを再同期
    if (slackChannelChanged && newSlackChannelId) {
      after(async () => {
        await syncProjectUsergroup(id)
      })
    }

    // ステータスが ended に変わった場合、ユーザーグループを無効化
    const oldStatus = oldProject?.status || null
    if (dbStatus === 'completed' && oldStatus !== 'completed') {
      after(async () => {
        await disableProjectUsergroup(id)
      })
    }

    // ステータスが ended 以外に戻った場合（ended → active 等）、ユーザーグループを再有効化
    if (oldStatus === 'completed' && dbStatus !== 'completed') {
      after(async () => {
        await syncProjectUsergroup(id)
      })
    }

    // PJ名（またはカレンダー表示名）が変更された場合、ユーザーグループ名を更新
    const oldDisplayName = (oldProject?.custom_fields as Record<string, unknown>)?.calendar_display_name as string || oldProject?.name || ''
    const newDisplayName = calDisplayName || rest.name
    if (oldDisplayName !== newDisplayName && dbStatus !== 'completed') {
      after(async () => {
        await updateProjectUsergroupName(id, newDisplayName)
      })
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
