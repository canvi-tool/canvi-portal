import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'

/**
 * GET /api/staff/me
 * ログインユーザーのスタッフ情報を返す
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'スタッフ情報が見つかりません' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/staff/me error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
