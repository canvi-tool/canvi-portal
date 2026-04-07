/**
 * GET  /api/payment-notices       — 一覧
 * POST /api/payment-notices       — 計算 + 新規作成 (PJ単位)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  generatePaymentNotice,
  generatePaymentNoticeSchema,
  listPaymentNotices,
} from '@/lib/billing/payment-notice-service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const items = await listPaymentNotices({
      yearMonth: searchParams.get('yearMonth') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      projectId: searchParams.get('projectId') ?? undefined,
    })
    return NextResponse.json({ items })
  } catch (error) {
    console.error('GET /api/payment-notices error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = generatePaymentNoticeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const result = await generatePaymentNotice(parsed.data, user.id)
    return NextResponse.json({ id: result.id, calculation: result.calculation })
  } catch (error) {
    console.error('POST /api/payment-notices error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '支払通知書の生成に失敗しました',
      },
      { status: 500 }
    )
  }
}
