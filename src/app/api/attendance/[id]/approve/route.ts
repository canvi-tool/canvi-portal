import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'

interface RouteParams {
  params: Promise<{ id: string }>
}

// 打刻修正の承認（管理者用）
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    if (!isOwner(user) && !isAdmin(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const supabase = await createServerSupabaseClient()

    // 対象レコード取得
    const { data: record, error: fetchError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !record) {
      return NextResponse.json({ error: '打刻記録が見つかりません' }, { status: 404 })
    }

    // ステータスを approved に更新
    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        status: 'approved',
        modified_by: user.id,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('POST /api/attendance/[id]/approve error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
