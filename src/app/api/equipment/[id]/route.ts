import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'

type RouteParams = { params: Promise<{ id: string }> }

// GET: 備品詳細
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any

    const { data, error } = await supabase
      .from('equipment_items')
      .select(`
        *,
        category:category_code(code, name),
        maker:maker_code(code, name)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('GET equipment item error:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '備品が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET equipment item error:', error)
    return NextResponse.json({ error: '備品の取得に失敗しました' }, { status: 500 })
  }
}

// PUT: 備品更新
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
      'product_name', 'status', 'owner', 'purchase_date', 'remarks',
    ]
    const updateData: Record<string, unknown> = { updated_by: user.id }
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    const { data, error } = await supabase
      .from('equipment_items')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select(`
        *,
        category:category_code(code, name),
        maker:maker_code(code, name)
      `)
      .single()

    if (error) {
      console.error('PUT equipment item error:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '備品が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('PUT equipment item error:', error)
    return NextResponse.json({ error: '備品の更新に失敗しました' }, { status: 500 })
  }
}

// DELETE: 備品論理削除
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any

    const { data, error } = await supabase
      .from('equipment_items')
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single()

    if (error) {
      console.error('DELETE equipment item error:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '備品が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('DELETE equipment item error:', error)
    return NextResponse.json({ error: '備品の削除に失敗しました' }, { status: 500 })
  }
}
