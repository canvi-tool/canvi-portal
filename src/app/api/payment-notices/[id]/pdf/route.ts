/**
 * GET /api/payment-notices/:id/pdf
 * 支払通知書PDFをサーバ生成してダウンロード返却。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  getPaymentNotice,
  toPdfData,
} from '@/lib/billing/payment-notice-service'
import { renderBillingPdfBuffer } from '@/lib/billing/pdf-generator'

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

    const pdfData = toPdfData(notice)
    const buffer = await renderBillingPdfBuffer(pdfData)

    const filename = `${pdfData.documentNumber || 'payment-notice'}.pdf`
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/payment-notices/:id/pdf error:', error)
    return NextResponse.json(
      { error: 'PDF生成に失敗しました' },
      { status: 500 }
    )
  }
}
