import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isAdmin, isOwner } from '@/lib/auth/rbac'
import { leaveGrantSchema } from '@/lib/validations/leave'

// GET /api/leave/grants - 付与履歴一覧
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staff_id')

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('leave_grants')
      .select('*, staff:staff_id(id, last_name, first_name)', { count: 'exact' })
      .order('grant_date', { ascending: false })

    // 管理者以外は自分の付与のみ
    if (!isAdmin(user)) {
      if (!user.staffId) {
        return NextResponse.json({ data: [], total: 0 })
      }
      query = query.eq('staff_id', user.staffId)
    } else if (staffId) {
      query = query.eq('staff_id', staffId)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = (data || []).map((grant) => ({
      ...grant,
      staff_name: (() => {
        const s = grant.staff as { last_name?: string; first_name?: string } | null
        return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : ''
      })(),
    }))

    return NextResponse.json({ data: result, total: count || 0 })
  } catch (error) {
    console.error('GET /api/leave/grants error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

// POST /api/leave/grants - 有給付与（管理者のみ）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = leaveGrantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    if (!isOwner(user)) {
      return NextResponse.json({ error: '有給付与はオーナーのみ実行できます' }, { status: 403 })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('leave_grants')
      .insert({
        staff_id: parsed.data.staff_id,
        grant_date: parsed.data.grant_date,
        expiry_date: parsed.data.expiry_date,
        grant_type: parsed.data.grant_type,
        total_days: parsed.data.total_days,
        note: parsed.data.note || null,
        created_by: user.id,
      } as never)
      .select('*, staff:staff_id(id, last_name, first_name)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/leave/grants error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
