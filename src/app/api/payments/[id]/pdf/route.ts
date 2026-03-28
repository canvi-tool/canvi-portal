import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { COMPENSATION_RULE_TYPE_LABELS, EMPLOYMENT_TYPE_LABELS } from '@/lib/constants'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/payments/:id/pdf
 * 支払通知書のデータ（PDF生成用）を返す。
 * フロントエンド側で @react-pdf/renderer を使用してPDFを生成する。
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
          full_name,
          full_name_kana,
          email,
          employment_type,
          status
        )
      `)
      .eq('id', id)
      .single()

    if (error || !payment) {
      return NextResponse.json({ error: '支払い計算が見つかりません' }, { status: 404 })
    }

    // ステータスチェック: 確定済みまたは発行済みのみPDF生成可能
    if (payment.status !== 'confirmed' && payment.status !== 'issued') {
      return NextResponse.json(
        { error: '確定済みまたは発行済みの計算のみPDF生成が可能です' },
        { status: 400 }
      )
    }

    // payment_calculation_lines 取得
    const { data: lines } = await supabase
      .from('payment_calculation_lines')
      .select('*')
      .eq('payment_calculation_id', id)
      .order('sort_order', { ascending: true })

    const staff = payment.staff as { id: string; full_name: string; full_name_kana: string | null; email: string; employment_type: string; status: string } | null

    // PDF用データ構築
    const pdfData = {
      title: '支払通知書',
      yearMonth: payment.year_month,
      issuedDate: payment.issued_at
        ? new Date(payment.issued_at).toLocaleDateString('ja-JP')
        : new Date().toLocaleDateString('ja-JP'),
      staff: {
        name: staff?.full_name ?? '',
        nameKana: staff?.full_name_kana ?? '',
        email: staff?.email ?? '',
        employmentType: EMPLOYMENT_TYPE_LABELS[staff?.employment_type ?? ''] ?? '',
      },
      lines: (lines ?? []).map((line) => ({
        name: line.rule_name,
        type: COMPENSATION_RULE_TYPE_LABELS[line.rule_type] ?? line.rule_type,
        amount: line.amount,
        detail: line.detail,
      })),
      totalAmount: payment.total_amount,
      notes: payment.notes,
    }

    return NextResponse.json(pdfData)
  } catch (error) {
    console.error('GET /api/payments/:id/pdf error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
