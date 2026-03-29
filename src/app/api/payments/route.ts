import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * GET /api/payments?yearMonth=YYYY-MM&status=...
 * 指定月の支払い計算一覧を取得する。
 */
export async function GET(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('GET /api/payments error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
