import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'

type RouteParams = { params: Promise<{ id: string }> }

// POST: ゴミ箱から復元（deleted_at を null に戻す）
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any

    const { data, error } = await supabase
      .from('equipment_items')
      .update({ deleted_at: null, updated_by: user.id })
      .eq('id', id)
      .not('deleted_at', 'is', null)
      .select('id')
      .single()

    if (error) {
      console.error('Restore equipment item error:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '復元対象の備品が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Restore equipment item error:', error)
    return NextResponse.json({ error: '備品の復元に失敗しました' }, { status: 500 })
  }
}
