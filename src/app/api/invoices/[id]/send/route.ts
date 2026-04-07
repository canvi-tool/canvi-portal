import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'
import { getInvoice, updateInvoice } from '@/lib/billing/invoice-service'
import { sendEmail } from '@/lib/email/send'

const sendSchema = z.object({
  to_email: z.string().email().optional(),
  message: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user) && !isAdmin(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const invoice = (await getInvoice(supabase, id)) as unknown as {
      id: string
      invoice_number: string
      sent_to_email: string | null
      total_amount: number
      due_date: string
      client: { name: string; email: string | null } | null
      project: { name: string } | null
    }

    const toEmail =
      parsed.data.to_email ?? invoice.sent_to_email ?? invoice.client?.email ?? null
    if (!toEmail) {
      return NextResponse.json(
        { error: '送付先メールアドレスが指定されていません' },
        { status: 400 },
      )
    }

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <p>${invoice.client?.name ?? ''} 御中</p>
        <p>いつもお世話になっております。<br />
        ${invoice.project?.name ?? ''} の請求書を発行いたしましたのでご確認ください。</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding:4px 12px;color:#64748b">請求番号</td><td style="padding:4px 0;font-weight:600">${invoice.invoice_number}</td></tr>
          <tr><td style="padding:4px 12px;color:#64748b">請求金額</td><td style="padding:4px 0;font-weight:600">¥${Number(invoice.total_amount).toLocaleString('ja-JP')}</td></tr>
          <tr><td style="padding:4px 12px;color:#64748b">支払期限</td><td style="padding:4px 0;font-weight:600">${invoice.due_date}</td></tr>
        </table>
        ${parsed.data.message ? `<p>${parsed.data.message}</p>` : ''}
        <p style="color:#64748b;font-size:12px;margin-top:24px">本メールは Canvi Portal から自動送信されています。</p>
      </div>
    `

    await sendEmail({
      to: toEmail,
      subject: `【請求書】${invoice.invoice_number} ${invoice.project?.name ?? ''}`,
      html,
    })

    const updated = await updateInvoice(supabase, id, {
      status: 'sent',
      sent_to_email: toEmail,
      user_id: user.id,
    })

    // 送付完了フラグ・送付日時を直接更新（updateInvoice は status しか面倒見ない場合に備えて）
    await supabase
      .from('invoices')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('POST /api/invoices/[id]/send error:', error)
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
