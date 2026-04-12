import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'

// GET: 備品一覧（フィルタ・検索対応）
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const categoryCode = searchParams.get('category_code')
    const search = searchParams.get('search')

    let query = supabase
      .from('equipment_items')
      .select(`
        *,
        category:category_code(code, name),
        maker:maker_code(code, name)
      `)
      .is('deleted_at', null)
      .order('management_number', { ascending: true })

    if (status) {
      query = query.eq('status', status)
    }
    if (categoryCode) {
      query = query.eq('category_code', categoryCode)
    }
    if (search) {
      query = query.or(`product_name.ilike.%${search}%,management_number.ilike.%${search}%`)
    }

    const { data, error } = await query
    if (error) {
      console.error('GET equipment items error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('GET equipment items error:', error)
    return NextResponse.json({ error: '備品一覧の取得に失敗しました' }, { status: 500 })
  }
}

// POST: 備品新規登録（管理番号自動採番）
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const body = await request.json()
    const { category_code, maker_code, product_name, status: itemStatus, owner, purchase_date, remarks } = body

    if (!category_code || !maker_code) {
      return NextResponse.json({ error: 'カテゴリコードとメーカーコードは必須です' }, { status: 400 })
    }

    // 管理番号の自動採番: category_code + maker_code + 連番
    const prefix = `${category_code}${maker_code}`

    const { data: existing, error: fetchError } = await supabase
      .from('equipment_items')
      .select('serial_number')
      .eq('category_code', category_code)
      .eq('maker_code', maker_code)
      .order('serial_number', { ascending: false })
      .limit(1)

    if (fetchError) {
      console.error('Fetch max serial error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const nextSerial = existing && existing.length > 0 ? existing[0].serial_number + 1 : 1
    if (nextSerial > 99) {
      return NextResponse.json({ error: '管理番号が上限（99）に達しています。同じ種別・メーカーの組み合わせではこれ以上登録できません。' }, { status: 400 })
    }
    const serialStr = String(nextSerial).padStart(2, '0')
    const managementNumber = `${prefix}${serialStr}`

    const { data, error } = await supabase
      .from('equipment_items')
      .insert({
        management_number: managementNumber,
        category_code,
        maker_code,
        serial_number: nextSerial,
        product_name: product_name || null,
        status: itemStatus || 'available',
        owner: owner || null,
        purchase_date: purchase_date || null,
        remarks: remarks || null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select(`
        *,
        category:category_code(code, name),
        maker:maker_code(code, name)
      `)
      .single()

    if (error) {
      console.error('POST equipment item error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('POST equipment item error:', error)
    return NextResponse.json({ error: '備品の登録に失敗しました' }, { status: 500 })
  }
}
