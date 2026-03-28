import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { shiftApprovalSchema } from '@/lib/validations/shift'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/shifts/[id]/submit - シフトを提出 (DRAFT → SUBMITTED)
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const parsed = shiftApprovalSchema.safeParse({ action: 'COMMENT', ...body })
    const comment = parsed.success ? parsed.data.comment : undefined

    if (DEMO_MODE) {
      return NextResponse.json({
        id,
        status: 'SUBMITTED',
        submitted_at: new Date().toISOString(),
        message: 'シフトを提出しました',
      })
    }

    const supabase = await createServerSupabaseClient()

    // 現在のシフトを確認
    const { data: shift, error: fetchError } = await supabase
      .from('shifts')
      .select('id, status, staff_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !shift) {
      return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
    }

    // DRAFT または NEEDS_REVISION のみ提出可能
    if (shift.status !== 'DRAFT' && shift.status !== 'NEEDS_REVISION') {
      return NextResponse.json(
        { error: `現在のステータス(${shift.status})では提出できません` },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // ステータスを SUBMITTED に更新
    const { data, error } = await supabase
      .from('shifts')
      .update({
        status: 'SUBMITTED',
        submitted_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 承認履歴に記録
    if (comment) {
      await supabase.from('shift_approval_history').insert({
        shift_id: id,
        action: 'COMMENT',
        comment,
        performed_by: body.performed_by || data.created_by,
      })
    }

    return NextResponse.json({
      ...data,
      message: 'シフトを提出しました',
    })
  } catch (error) {
    console.error('POST /api/shifts/[id]/submit error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
