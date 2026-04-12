import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/rbac'

/**
 * GET /api/alerts/ignores
 * アクティブな無視ルール一覧を取得
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('alert_ignores')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

/**
 * POST /api/alerts/ignores
 * 新しい無視ルールを作成（オーナーのみ）
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin()
    const body = await request.json()

    const { alert_type, staff_id, project_id, reason } = body

    if (!alert_type || typeof alert_type !== 'string') {
      return NextResponse.json({ error: 'alert_typeは必須です' }, { status: 400 })
    }

    const admin = createAdminClient()

    const insertData = {
      created_by: user.id,
      alert_type,
      staff_id: staff_id || null,
      project_id: project_id || null,
      reason: reason || null,
      is_active: true,
    }

    const { data, error } = await admin
      .from('alert_ignores')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      // ユニーク制約違反 = 既に同じパターンが存在
      if (error.code === '23505') {
        return NextResponse.json({ error: 'このパターンは既に無視設定されています' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'Forbidden') {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

/**
 * DELETE /api/alerts/ignores
 * 無視ルールを無効化（オーナーのみ）
 * body: { id: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'idは必須です' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { error } = await admin
      .from('alert_ignores')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'Forbidden') {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
