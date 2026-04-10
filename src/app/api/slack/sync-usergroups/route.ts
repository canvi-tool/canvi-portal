import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { syncProjectUsergroup } from '@/lib/integrations/slack'

/**
 * POST /api/slack/sync-usergroups
 * 全アクティブプロジェクトのSlackユーザーグループを一括同期する
 * 管理者のみ実行可能（初期セットアップ・デバッグ用）
 */
export async function POST() {
  try {
    const admin = await requireAdmin().catch(() => null)
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const supabase = await createServerSupabaseClient()

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, name, project_code, slack_channel_id')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('project_code')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({ message: 'アクティブなプロジェクトが見つかりません', results: [] })
    }

    const results: Array<{
      project_code: string
      project_name: string
      status: 'ok' | 'error'
      error?: string
    }> = []

    for (const project of projects) {
      try {
        await syncProjectUsergroup(project.id)
        results.push({
          project_code: project.project_code,
          project_name: project.name,
          status: 'ok',
        })
      } catch (err) {
        results.push({
          project_code: project.project_code,
          project_name: project.name,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    const okCount = results.filter((r) => r.status === 'ok').length
    const errCount = results.filter((r) => r.status === 'error').length

    return NextResponse.json({
      message: `${projects.length}プロジェクト処理完了: ${okCount}成功, ${errCount}エラー`,
      results,
    })
  } catch (error) {
    console.error('POST /api/slack/sync-usergroups error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
