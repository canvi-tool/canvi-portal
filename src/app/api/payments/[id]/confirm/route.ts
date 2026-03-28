import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { canTransition, type PaymentStatus } from '@/lib/validations/payment'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/payments/:id/confirm
 * 支払い計算を確定する。
 *
 * Body: { action: 'confirm' | 'reject' | 'issue' }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const action = body.action as string

    // 現在のステータス取得
    const { data: current, error: fetchError } = await supabase
      .from('payment_calculations')
      .select('status')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: '支払い計算が見つかりません' }, { status: 404 })
    }

    const currentStatus = current.status as PaymentStatus

    // アクションに応じた遷移先を決定
    let targetStatus: PaymentStatus
    switch (action) {
      case 'confirm':
        targetStatus = 'confirmed'
        break
      case 'reject':
        targetStatus = currentStatus === 'confirmed' ? 'needs_review' : 'aggregated'
        break
      case 'issue':
        targetStatus = 'issued'
        break
      default:
        return NextResponse.json({ error: '無効なアクションです' }, { status: 400 })
    }

    // 遷移可能かチェック
    if (!canTransition(currentStatus, targetStatus)) {
      return NextResponse.json(
        {
          error: `ステータス "${currentStatus}" から "${targetStatus}" への変更はできません`,
        },
        { status: 400 }
      )
    }

    // 更新データ構築
    const updateData: Record<string, unknown> = {
      status: targetStatus,
    }

    if (targetStatus === 'confirmed') {
      updateData.confirmed_at = new Date().toISOString()
      updateData.confirmed_by = user.id
    }

    if (targetStatus === 'issued') {
      updateData.issued_at = new Date().toISOString()
    }

    // 差戻しの場合は確定情報をクリア
    if (action === 'reject') {
      updateData.confirmed_at = null
      updateData.confirmed_by = null
    }

    const { data: updated, error: updateError } = await supabase
      .from('payment_calculations')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        staff:staff_id (
          id,
          full_name,
          email,
          employment_type
        )
      `)
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST /api/payments/:id/confirm error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
