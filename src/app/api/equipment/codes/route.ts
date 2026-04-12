import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'

// GET: カテゴリコード・メーカーコード一覧
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any

    const [categoryResult, makerResult] = await Promise.all([
      supabase
        .from('equipment_category_codes')
        .select('code, name, sort_order')
        .order('sort_order', { ascending: true }),
      supabase
        .from('equipment_maker_codes')
        .select('code, name, sort_order')
        .order('sort_order', { ascending: true }),
    ])

    if (categoryResult.error) {
      console.error('GET category codes error:', categoryResult.error)
      return NextResponse.json({ error: categoryResult.error.message }, { status: 500 })
    }
    if (makerResult.error) {
      console.error('GET maker codes error:', makerResult.error)
      return NextResponse.json({ error: makerResult.error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: {
        category_codes: categoryResult.data || [],
        maker_codes: makerResult.data || [],
      },
    })
  } catch (error) {
    console.error('GET equipment codes error:', error)
    return NextResponse.json({ error: 'コード一覧の取得に失敗しました' }, { status: 500 })
  }
}
