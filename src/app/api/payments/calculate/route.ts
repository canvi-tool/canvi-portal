import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { calculateRequestSchema } from '@/lib/validations/payment'
import { calculateMonthlyPayments } from '@/lib/calculations/engine'

/**
 * POST /api/payments/calculate
 * 月次計算を実行する。
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // 認証チェック
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = calculateRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { year_month } = parsed.data

    console.log(`[API] 月次計算開始: ${year_month}`)

    const result = await calculateMonthlyPayments(supabase, year_month)

    console.log(
      `[API] 月次計算完了: ${year_month}, 対象${result.totalStaff}名, 総額${result.totalAmount}円`
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/payments/calculate error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
