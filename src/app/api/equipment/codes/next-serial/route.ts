import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'

// GET: 次の管理番号プレビューを返す
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const maker = searchParams.get('maker')

    if (!category || !maker) {
      return NextResponse.json({ error: 'category と maker は必須です' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any

    const { data: existing } = await supabase
      .from('equipment_items')
      .select('serial_number')
      .eq('category_code', category)
      .eq('maker_code', maker)
      .order('serial_number', { ascending: false })
      .limit(1)

    const nextSerial = existing && existing.length > 0 ? Number(existing[0].serial_number) + 1 : 1
    const serialStr = String(nextSerial).padStart(2, '0')
    const managementNumber = `${category}${maker}${serialStr}`

    return NextResponse.json({
      data: {
        management_number: managementNumber,
        next_serial: nextSerial,
      },
    })
  } catch (error) {
    console.error('GET next-serial error:', error)
    return NextResponse.json({ error: '次番号の取得に失敗しました' }, { status: 500 })
  }
}
