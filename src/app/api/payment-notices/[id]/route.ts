/**
 * GET    /api/payment-notices/:id  — 詳細
 * PUT    /api/payment-notices/:id  — 更新
 * DELETE /api/payment-notices/:id  — 取消（論理削除）
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  deletePaymentNotice,
  getPaymentNotice,
  updatePaymentNotice,
  updatePaymentNoticeSchema,
} from '@/lib/billing/payment-notice-service'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const notice = await getPaymentNotice(id)
    if (!notice) {
      return NextResponse.json(
        { error: '支払通知書が見つかりません' },
        { status: 404 }
      )
    }
    return NextResponse.json(notice)
  } catch (error) {
    console.error('GET /api/payment-notices/:id error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

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
    const parsed = updatePaymentNoticeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await updatePaymentNotice(id, parsed.data)
    const updated = await getPaymentNotice(id)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT /api/payment-notices/:id error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    await deletePaymentNotice(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/payment-notices/:id error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
