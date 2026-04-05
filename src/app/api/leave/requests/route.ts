import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isAdmin } from '@/lib/auth/rbac'
import { leaveRequestSchema } from '@/lib/validations/leave'

// GET /api/leave/requests - 申請一覧（フィルター付き）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staff_id')
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('leave_requests')
      .select('*, staff:staff_id(id, last_name, first_name), leave_grant:leave_grant_id(id, grant_type, grant_date, expiry_date)', { count: 'exact' })
      .order('created_at', { ascending: false })

    // 管理者以外は自分の申請のみ
    if (!isAdmin(user)) {
      if (!user.staffId) {
        return NextResponse.json({ data: [], total: 0 })
      }
      query = query.eq('staff_id', user.staffId)
    } else if (staffId) {
      query = query.eq('staff_id', staffId)
    }

    if (status) {
      query = query.eq('status', status as 'pending' | 'approved' | 'rejected' | 'cancelled')
    }
    if (startDate) {
      query = query.gte('start_date', startDate)
    }
    if (endDate) {
      query = query.lte('end_date', endDate)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = (data || []).map((req) => ({
      ...req,
      staff_name: (() => {
        const s = req.staff as { last_name?: string; first_name?: string } | null
        return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : ''
      })(),
    }))

    return NextResponse.json({ data: result, total: count || 0 })
  } catch (error) {
    console.error('GET /api/leave/requests error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

// POST /api/leave/requests - 有給申請作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = leaveRequestSchema.safeParse(body)
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

    // 管理者以外は自分のスタッフIDでのみ申請可能
    if (!isAdmin(user)) {
      if (!user.staffId || user.staffId !== parsed.data.staff_id) {
        return NextResponse.json({ error: '他のスタッフの有給申請はできません' }, { status: 403 })
      }
    }

    const supabase = await createServerSupabaseClient()

    // leave_grant_idが指定されている場合、残日数チェック
    if (parsed.data.leave_grant_id) {
      const { data: grant, error: grantError } = await supabase
        .from('leave_grants')
        .select('id, remaining_days, expiry_date, staff_id')
        .eq('id', parsed.data.leave_grant_id)
        .single()

      if (grantError || !grant) {
        return NextResponse.json({ error: '指定された付与レコードが見つかりません' }, { status: 404 })
      }

      if (grant.staff_id !== parsed.data.staff_id) {
        return NextResponse.json({ error: '付与レコードのスタッフが一致しません' }, { status: 400 })
      }

      const today = new Date().toISOString().split('T')[0]
      if (grant.expiry_date < today) {
        return NextResponse.json({ error: '指定された付与レコードは有効期限切れです' }, { status: 400 })
      }

      if (Number(grant.remaining_days) < parsed.data.days) {
        return NextResponse.json(
          { error: `残日数が不足しています（残: ${grant.remaining_days}日、申請: ${parsed.data.days}日）` },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        staff_id: parsed.data.staff_id,
        leave_grant_id: parsed.data.leave_grant_id || null,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        leave_type: parsed.data.leave_type,
        hours: parsed.data.hours || null,
        days: parsed.data.days,
        reason: parsed.data.reason || null,
        status: 'pending',
      } as never)
      .select('*, staff:staff_id(id, last_name, first_name)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/leave/requests error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
