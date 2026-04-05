import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { shiftApprovalSchema } from '@/lib/validations/shift'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/shifts/[id]/reject - シフトを却下 (SUBMITTED → REJECTED)
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const parsed = shiftApprovalSchema.safeParse({ action: 'REJECT', ...body })
    const comment = parsed.success ? parsed.data.comment : undefined

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
        { error: `現在のステータス(${shift.status})では却下できません。提出済みのシフトのみ却下可能です。` },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const performedBy = body.performed_by

    // ステータスを REJECTED に更新
    const { data, error } = await supabase
      .from('shifts')
      .update({
        status: 'REJECTED',
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
      action: 'REJECT',
      comment: comment || null,
      performed_by: performedBy,
    })

    return NextResponse.json({
      ...data,
      message: 'シフトを却下しました',
    })
  } catch (error) {
    console.error('POST /api/shifts/[id]/reject error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
