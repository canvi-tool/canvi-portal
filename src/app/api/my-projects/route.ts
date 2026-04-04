import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'

/**
 * 自分がアサインされているアクティブなプロジェクト一覧を取得
 * staff → project_assignments → projects の結合
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()

    // まず自分のstaff_idを取得
    const { data: staffRecord } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (!staffRecord) {
      return NextResponse.json([])
    }

    // project_assignments経由でアサインされているプロジェクトを取得
    const { data: assignments, error } = await supabase
      .from('project_assignments')
      .select(`
        project_id,
        status,
        project:project_id (
          id,
          name,
          project_code,
          status,
          slack_channel_id,
          slack_channel_name
        )
      `)
      .eq('staff_id', staffRecord.id)
      .is('deleted_at', null)
      .in('status', ['confirmed', 'in_progress'])

    if (error) {
      console.error('GET /api/my-projects error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // プロジェクトを抽出してアクティブなもののみ返す
    const projects = (assignments || [])
      .map((a) => a.project)
      .filter((p): p is NonNullable<typeof p> =>
        p != null && typeof p === 'object' && 'status' in p && p.status === 'active'
      )
      // 重複除去（複数アサインがある場合）
      .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)

    return NextResponse.json(projects)
  } catch (error) {
    console.error('GET /api/my-projects error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
