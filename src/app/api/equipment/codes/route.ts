import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

// POST: カテゴリコード・メーカーコード追加
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    const body = await request.json()
    const { type, code, name } = body as { type: string; code: string; name: string }

    // Validate type
    if (type !== 'category' && type !== 'maker') {
      return NextResponse.json({ error: 'type は category または maker を指定してください' }, { status: 400 })
    }

    // Validate code: 2-3 uppercase chars
    const upperCode = (code || '').toUpperCase().trim()
    if (!/^[A-Z]{2,3}$/.test(upperCode)) {
      return NextResponse.json({ error: 'コードは半角英大文字2〜3文字で入力してください' }, { status: 400 })
    }

    // Validate name
    const trimmedName = (name || '').trim()
    if (!trimmedName) {
      return NextResponse.json({ error: '名称は必須です' }, { status: 400 })
    }

    const tableName = type === 'category' ? 'equipment_category_codes' : 'equipment_maker_codes'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    // Get max sort_order
    const { data: maxRow } = await admin
      .from(tableName)
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = (maxRow?.sort_order ?? 0) + 1

    // Insert
    const { data, error } = await admin
      .from(tableName)
      .insert({ code: upperCode, name: trimmedName, sort_order: nextSortOrder })
      .select('code, name, sort_order')
      .single()

    if (error) {
      console.error('POST equipment code error:', error)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'このコードは既に使用されています' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('POST equipment codes error:', error)
    return NextResponse.json({ error: 'コードの追加に失敗しました' }, { status: 500 })
  }
}
