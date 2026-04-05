import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'

// GET /api/leave/balance - 自分の有給残日数を取得
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    if (!user.staffId) {
      return NextResponse.json({ error: 'スタッフ情報が見つかりません' }, { status: 404 })
    }

    const supabase = await createServerSupabaseClient()

    // 有効期限内の付与レコードを取得
    const today = new Date().toISOString().split('T')[0]
    const { data: grants, error } = await supabase
      .from('leave_grants')
      .select('id, grant_date, expiry_date, grant_type, total_days, used_days, remaining_days')
      .eq('staff_id', user.staffId)
      .gte('expiry_date', today)
      .order('expiry_date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // サマリー計算
    const summary = {
      total_granted: 0,
      total_used: 0,
      total_remaining: 0,
    }

    for (const grant of grants || []) {
      summary.total_granted += Number(grant.total_days) || 0
      summary.total_used += Number(grant.used_days) || 0
      summary.total_remaining += Number(grant.remaining_days) || 0
    }

    return NextResponse.json({
      grants: grants || [],
      summary,
    })
  } catch (error) {
    console.error('GET /api/leave/balance error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
