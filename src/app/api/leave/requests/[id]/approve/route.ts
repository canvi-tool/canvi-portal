import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isAdmin } from '@/lib/auth/rbac'
import { leaveApprovalSchema } from '@/lib/validations/leave'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/leave/requests/[id]/approve - 有給申請を承認（管理者のみ）
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: '有給申請の承認は管理者のみ実行できます' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = leaveApprovalSchema.safeParse({ action: 'approve', ...body })
    const comment = parsed.success ? parsed.data.comment : undefined

    const supabase = await createServerSupabaseClient()

    // 申請を取得
    const { data: leaveRequest, error: fetchError } = await supabase
      .from('leave_requests')
      .select('id, status, staff_id, leave_grant_id, days')
      .eq('id', id)
      .single()

    if (fetchError || !leaveRequest) {
      return NextResponse.json({ error: '有給申請が見つかりません' }, { status: 404 })
    }

    if (leaveRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `現在のステータス(${leaveRequest.status})では承認できません。申請中の有給のみ承認可能です。` },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // ステータスを approved に更新（競合防止のためステータスもWHERE条件に）
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: now,
        approval_comment: comment || null,
        updated_at: now,
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select('*, staff:staff_id(id, last_name, first_name)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 付与レコードの used_days を更新
    if (leaveRequest.leave_grant_id) {
      const { data: grant } = await supabase
        .from('leave_grants')
        .select('used_days')
        .eq('id', leaveRequest.leave_grant_id)
        .single()

      if (grant) {
        const newUsedDays = Number(grant.used_days) + Number(leaveRequest.days)
        await supabase
          .from('leave_grants')
          .update({ used_days: newUsedDays } as never)
          .eq('id', leaveRequest.leave_grant_id)
      }
    }

    return NextResponse.json({
      ...data,
      message: '有給申請を承認しました',
    })
  } catch (error) {
    console.error('POST /api/leave/requests/[id]/approve error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
