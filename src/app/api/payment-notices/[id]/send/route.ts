/**
 * POST /api/payment-notices/:id/send
 * 支払通知書PDFを生成し、メール送信 (Resend)。送信先デフォルト: invoice@canvi.co.jp
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getPaymentNotice,
  toPdfData,
} from '@/lib/billing/payment-notice-service'
import { renderBillingPdfBuffer } from '@/lib/billing/pdf-generator'

interface RouteParams {
  params: Promise<{ id: string }>
}

const sendSchema = z.object({
  to: z.string().email().optional(),
  cc: z.array(z.string().email()).optional(),
  message: z.string().optional(),
})

const DEFAULT_TO = 'invoice@canvi.co.jp'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@canvi.co.jp'
const FROM_NAME = process.env.RESEND_FROM_NAME || 'Canvi Portal'

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

    const body = await request.json().catch(() => ({}))
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const notice = await getPaymentNotice(id)
    if (!notice) {
      return NextResponse.json(
        { error: '支払通知書が見つかりません' },
        { status: 404 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY が未設定です' },
        { status: 500 }
      )
    }

    const pdfData = toPdfData(notice)
    const buffer = await renderBillingPdfBuffer(pdfData)
    const filename = `${pdfData.documentNumber || 'payment-notice'}.pdf`

    const resend = new Resend(apiKey)
    const to = parsed.data.to ?? DEFAULT_TO

    const html = `
      <div style="font-family: sans-serif; max-width: 600px;">
        <p>${pdfData.recipientName} ${pdfData.recipientHonorific}</p>
        <p>${pdfData.subject} の支払通知書をお送りします。</p>
        <p>支払予定日: ${pdfData.paymentDueDate}<br/>金額: ¥${pdfData.total_amount.toLocaleString('ja-JP')}（税込）</p>
        ${parsed.data.message ? `<p>${parsed.data.message}</p>` : ''}
        <hr/>
        <p style="font-size:12px;color:#888;">Canvi株式会社</p>
      </div>
    `

    const { error: mailErr } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      cc: parsed.data.cc,
      subject: `【支払通知書】${pdfData.subject}`,
      html,
      attachments: [
        {
          filename,
          content: buffer,
        },
      ],
    })

    if (mailErr) {
      throw new Error(`メール送信失敗: ${mailErr.message}`)
    }

    // 送信完了の状態を更新
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('payment_calculations')
      .update({
        notice_status: 'sent',
        sent_at: new Date().toISOString(),
        sent_to_email: to,
      })
      .eq('id', id)

    return NextResponse.json({ ok: true, sent_to: to })
  } catch (error) {
    console.error('POST /api/payment-notices/:id/send error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'メール送信に失敗しました',
      },
      { status: 500 }
    )
  }
}
