import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'

type RouteParams = { params: Promise<{ id: string }> }

// GET: 貸出記録詳細
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any

    const { data, error } = await supabase
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
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('GET lending record error:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '貸出記録が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET lending record error:', error)
    return NextResponse.json({ error: '貸出記録の取得に失敗しました' }, { status: 500 })
  }
}

// PUT: 貸出記録更新（返却日設定 → DBトリガーで備品ステータスを 'available' に自動更新）
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const body = await request.json()

    const allowedFields = [
      'return_date', 'pledge_status', 'pc_pin_code', 'remarks',
    ]
    const updateData: Record<string, unknown> = { updated_by: user.id }
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    const { data, error } = await supabase
      .from('equipment_lending_records')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
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
      .single()

    if (error) {
      console.error('PUT lending record error:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '貸出記録が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('PUT lending record error:', error)
    return NextResponse.json({ error: '貸出記録の更新に失敗しました' }, { status: 500 })
  }
}

// DELETE: 貸出記録論理削除
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any

    const { data, error } = await supabase
      .from('equipment_lending_records')
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single()

    if (error) {
      console.error('DELETE lending record error:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '貸出記録が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('DELETE lending record error:', error)
    return NextResponse.json({ error: '貸出記録の削除に失敗しました' }, { status: 500 })
  }
}
