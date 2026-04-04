import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { shiftApprovalSchema } from '@/lib/validations/shift'
import { syncShiftToCalendar } from '@/lib/integrations/google-calendar-sync'
import { getCurrentUser, isManagerOrOwner } from '@/lib/auth/rbac'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/shifts/[id]/approve - シフトを承認 (SUBMITTED → APPROVED)
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    // 認証・権限チェック: マネージャーまたはオーナーのみ承認可能
    const currentUser = await getCurrentUser()
    if (!currentUser || !isManagerOrOwner(currentUser)) {
      return NextResponse.json({ error: '承認権限がありません' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))

    const parsed = shiftApprovalSchema.safeParse({ action: 'APPROVE', ...body })
    const comment = parsed.success ? parsed.data.comment : undefined

    if (DEMO_MODE) {
      return NextResponse.json({
        id,
        status: 'APPROVED',
        approved_at: new Date().toISOString(),
        approved_by: 'user-001',
        message: 'シフトを承認しました',
      })
    }

    const supabase = await createServerSupabaseClient()

    // 現在のシフトを確認
    const { data: shift, error: fetchError } = await supabase
      .from('shifts')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !shift) {
      return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
    }

    if (shift.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: `現在のステータス(${shift.status})では承認できません。提出済みのシフトのみ承認可能です。` },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // ステータスを APPROVED に更新（認証済みユーザーIDを使用）
    const { data, error } = await supabase
      .from('shifts')
      .update({
        status: 'APPROVED',
        approved_at: now,
        approved_by: currentUser.id,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 承認履歴に記録
    await supabase.from('shift_approval_history').insert({
      shift_id: id,
      action: 'APPROVE',
      comment: comment || null,
      performed_by: currentUser.id,
    })

    // 承認時にGoogleカレンダー同期（fire-and-forget）
    if (data?.id) {
      syncShiftToCalendar(data.id).catch((e) =>
        console.error('Calendar sync on approve failed:', e)
      )
    }

    return NextResponse.json({
      ...data,
      message: 'シフトを承認しました',
    })
  } catch (error) {
    console.error('POST /api/shifts/[id]/approve error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
