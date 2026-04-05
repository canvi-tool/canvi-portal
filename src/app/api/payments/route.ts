import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'

/**
 * GET /api/payments?yearMonth=YYYY-MM&status=...
 * 指定月の支払い計算一覧を取得する。
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const yearMonth = searchParams.get('yearMonth')
    const status = searchParams.get('status')

    let query = supabase
      .from('payment_calculations')
      .select(`
        *,
        staff:staff_id (
          id,
          last_name,
          first_name,
          last_name_kana,
          first_name_kana,
          email,
          employment_type,
          status
        )
      `)
      .order('created_at', { ascending: false })

    if (yearMonth) {
      query = query.eq('year_month', yearMonth)
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('GET /api/payments query error:', error.message)
      return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('GET /api/payments error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
