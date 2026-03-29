import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { paymentUpdateSchema } from '@/lib/validations/payment'
import type { Json } from '@/lib/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/payments/:id
 * 支払い計算の詳細を取得する（明細行を含む）。
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    // payment_calculations 取得
    const { data: payment, error } = await supabase
      .from('payment_calculations')
      .select(`
        *,
        staff:staff_id (
          id,
          last_name,
          first_name,
          last_name_kana,
          first_name_kana,
          email,
          employment_type,
          status,
          hire_date
        )
      `)
      .eq('id', id)
      .single()

    if (error || !payment) {
      return NextResponse.json(
        { error: '支払い計算が見つかりません' },
        { status: 404 }
      )
    }

    // payment_calculation_lines 取得
    const { data: lines } = await supabase
      .from('payment_calculation_lines')
      .select('*')
      .eq('payment_calculation_id', id)
      .order('sort_order', { ascending: true })

    return NextResponse.json({
      ...payment,
      lines: lines ?? [],
    })
  } catch (error) {
    console.error('GET /api/payments/:id error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

/**
 * PUT /api/payments/:id
 * 支払い計算を更新する（手動調整の追加、メモの更新）。
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const parsed = paymentUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // 現在のステータス確認
    const { data: current } = await supabase
      .from('payment_calculations')
      .select('status, total_amount')
      .eq('id', id)
      .single()

    if (!current) {
      return NextResponse.json({ error: '支払い計算が見つかりません' }, { status: 404 })
    }

    if (current.status === 'confirmed' || current.status === 'issued') {
      return NextResponse.json(
        { error: '確定済みまたは発行済みの計算は編集できません' },
        { status: 400 }
      )
    }

    const { notes, adjustments } = parsed.data

    // 手動調整行を追加
    if (adjustments && adjustments.length > 0) {
      // 既存の最大 sort_order を取得
      const { data: maxLine } = await supabase
        .from('payment_calculation_lines')
        .select('sort_order')
        .eq('payment_calculation_id', id)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()

      let sortOrder = (maxLine?.sort_order ?? 0)
      let additionalAmount = 0

      for (const adj of adjustments) {
        sortOrder++
        additionalAmount += adj.amount

        await supabase.from('payment_calculation_lines').insert({
          payment_calculation_id: id,
          compensation_rule_id: null,
          rule_name: adj.rule_name,
          rule_type: 'adjustment',
          amount: adj.amount,
          input_data: { manual: true, reason: adj.detail || adj.rule_name } as Json,
          detail: adj.detail || adj.rule_name,
          sort_order: sortOrder,
        })
      }

      // 合計金額を更新
      const newTotal = current.total_amount + additionalAmount

      await supabase
        .from('payment_calculations')
        .update({
          total_amount: newTotal,
          status: 'needs_review',
          notes: notes || null,
        })
        .eq('id', id)
    } else if (notes !== undefined) {
      await supabase
        .from('payment_calculations')
        .update({ notes: notes || null })
        .eq('id', id)
    }

    // 更新後のデータを返す
    const { data: updated } = await supabase
      .from('payment_calculations')
      .select(`
        *,
        staff:staff_id (
          id,
          last_name,
          first_name,
          last_name_kana,
          first_name_kana,
          email,
          employment_type,
          status
        )
      `)
      .eq('id', id)
      .single()

    const { data: lines } = await supabase
      .from('payment_calculation_lines')
      .select('*')
      .eq('payment_calculation_id', id)
      .order('sort_order', { ascending: true })

    return NextResponse.json({
      ...updated,
      lines: lines ?? [],
    })
  } catch (error) {
    console.error('PUT /api/payments/:id error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
