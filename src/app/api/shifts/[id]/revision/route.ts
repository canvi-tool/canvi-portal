import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { shiftApprovalSchema } from '@/lib/validations/shift'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/shifts/[id]/revision - 修正依頼 (SUBMITTED → NEEDS_REVISION)
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const parsed = shiftApprovalSchema.safeParse({ action: 'NEEDS_REVISION', ...body })
    const comment = parsed.success ? parsed.data.comment : undefined
    const newStartTime = parsed.success ? parsed.data.new_start_time : undefined
    const newEndTime = parsed.success ? parsed.data.new_end_time : undefined

    if (DEMO_MODE) {
      return NextResponse.json({
        id,
        status: 'NEEDS_REVISION',
        message: '修正を依頼しました',
      })
    }

    const supabase = await createServerSupabaseClient()

    // 現在のシフトを確認
    const { data: shift, error: fetchError } = await supabase
      .from('shifts')
      .select('id, status, start_time, end_time')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !shift) {
      return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
    }

    if (shift.status !== 'SUBMITTED') {
      return NextResponse.json(
        { error: `現在のステータス(${shift.status})では修正依頼できません。提出済みのシフトのみ対象です。` },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const performedBy = body.performed_by

    // ステータスを NEEDS_REVISION に更新
    const { data, error } = await supabase
      .from('shifts')
      .update({
        status: 'NEEDS_REVISION',
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 承認履歴に記録 (時刻変更の提案がある場合は MODIFY として記録)
    const action = newStartTime || newEndTime ? 'MODIFY' : 'NEEDS_REVISION'
    await supabase.from('shift_approval_history').insert({
      shift_id: id,
      action,
      comment: comment || null,
      previous_start_time: newStartTime || newEndTime ? shift.start_time : null,
      previous_end_time: newStartTime || newEndTime ? shift.end_time : null,
      new_start_time: newStartTime || null,
      new_end_time: newEndTime || null,
      performed_by: performedBy,
    })

    return NextResponse.json({
      ...data,
      message: '修正を依頼しました',
    })
  } catch (error) {
    console.error('POST /api/shifts/[id]/revision error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
