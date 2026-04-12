import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'

// GET: 貸出記録一覧
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staff_id')
    const activeOnly = searchParams.get('active_only') === 'true'

    let query = supabase
      .from('equipment_lending_records')
      .select(`
        *,
        staff:staff_id(id, last_name, first_name),
        items:equipment_lending_items(
          id,
          equipment_item_id,
          is_main_device,
          remarks,
          equipment_item:equipment_item_id(
            id,
            management_number,
            product_name,
            status,
            category:category_code(code, name),
            maker:maker_code(code, name)
          )
        )
      `)
      .is('deleted_at', null)
      .order('lending_date', { ascending: false })

    if (staffId) {
      query = query.eq('staff_id', staffId)
    }
    if (activeOnly) {
      query = query.is('return_date', null)
    }

    const { data, error } = await query
    if (error) {
      console.error('GET lending records error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('GET lending records error:', error)
    return NextResponse.json({ error: '貸出記録の取得に失敗しました' }, { status: 500 })
  }
}

// POST: 貸出記録作成（貸出アイテムも同時作成）
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const body = await request.json()
    const { staff_id, lending_date, pledge_status, pc_pin_code, remarks, items } = body

    if (!staff_id || !lending_date) {
      return NextResponse.json({ error: 'スタッフIDと貸出日は必須です' }, { status: 400 })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '貸出アイテムは1つ以上必要です' }, { status: 400 })
    }

    // 1. 貸出記録を作成
    const { data: record, error: recordError } = await supabase
      .from('equipment_lending_records')
      .insert({
        staff_id,
        lending_date,
        pledge_status: pledge_status || null,
        pc_pin_code: pc_pin_code || null,
        remarks: remarks || null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('*')
      .single()

    if (recordError) {
      console.error('POST lending record error:', recordError)
      return NextResponse.json({ error: recordError.message }, { status: 500 })
    }

    // 2. 貸出アイテムを作成（DBトリガーで備品ステータスが 'lent' に自動更新）
    const lendingItems = items.map((item: { equipment_item_id: string; is_main_device?: boolean; remarks?: string }) => ({
      lending_record_id: record.id,
      equipment_item_id: item.equipment_item_id,
      is_main_device: item.is_main_device || false,
      remarks: item.remarks || null,
    }))

    const { error: itemsError } = await supabase
      .from('equipment_lending_items')
      .insert(lendingItems)

    if (itemsError) {
      console.error('POST lending items error:', itemsError)
      // 貸出アイテム作成失敗時は貸出記録も削除
      await supabase.from('equipment_lending_records').delete().eq('id', record.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // 3. 作成した記録を関連データ付きで再取得
    const { data: fullRecord, error: fetchError } = await supabase
      .from('equipment_lending_records')
      .select(`
        *,
        staff:staff_id(id, last_name, first_name),
        items:equipment_lending_items(
          id,
          equipment_item_id,
          is_main_device,
          remarks,
          equipment_item:equipment_item_id(
            id,
            management_number,
            product_name,
            status
          )
        )
      `)
      .eq('id', record.id)
      .single()

    if (fetchError) {
      console.error('Fetch created record error:', fetchError)
      return NextResponse.json({ data: record }, { status: 201 })
    }

    return NextResponse.json({ data: fullRecord }, { status: 201 })
  } catch (error) {
    console.error('POST lending record error:', error)
    return NextResponse.json({ error: '貸出記録の作成に失敗しました' }, { status: 500 })
  }
}
