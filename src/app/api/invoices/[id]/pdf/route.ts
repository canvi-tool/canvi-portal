import { NextRequest } from 'next/server'
import React, { type ReactElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'
import { getInvoice } from '@/lib/billing/invoice-service'
import { InvoicePdfDocument, type InvoicePdfInput } from '@/lib/billing/invoice-pdf'

const ISSUER = {
  company_name: process.env.BILLING_ISSUER_NAME ?? 'Canvi株式会社',
  address: process.env.BILLING_ISSUER_ADDRESS ?? null,
  tel: process.env.BILLING_ISSUER_TEL ?? null,
  email: process.env.BILLING_ISSUER_EMAIL ?? null,
}

const DEFAULT_BANK = {
  bank_name: 'GMOあおぞらネット銀行',
  bank_branch: process.env.BILLING_BANK_BRANCH ?? null,
  bank_account_type: process.env.BILLING_BANK_ACCOUNT_TYPE ?? '普通',
  bank_account_number: process.env.BILLING_BANK_ACCOUNT_NUMBER ?? null,
  bank_account_holder: process.env.BILLING_BANK_ACCOUNT_HOLDER ?? null,
}

interface InvoiceItemRow {
  description: string
  quantity: number
  unit_price: number | null
  amount: number
  sort_order: number
}

interface InvoiceFull {
  id: string
  invoice_number: string
  issue_date: string
  due_date: string
  period_start: string
  period_end: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  notes: string | null
  bank_name: string | null
  bank_branch: string | null
  bank_account_type: string | null
  bank_account_number: string | null
  bank_account_holder: string | null
  project: { id: string; name: string } | null
  client: { id: string; name: string; address?: string | null } | null
  items: InvoiceItemRow[]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return new Response(JSON.stringify({ error: '認証が必要です' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (!isOwner(user) && !isAdmin(user)) {
      return new Response(JSON.stringify({ error: '権限がありません' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const invoice = (await getInvoice(supabase, id)) as unknown as InvoiceFull

    const items = (invoice.items ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unit: '',
        unit_price: it.unit_price,
        amount: Number(it.amount),
      }))

    const subject = `${invoice.project?.name ?? ''} ${invoice.period_start} 〜 ${invoice.period_end}`

    const pdfData: InvoicePdfInput = {
      invoiceNumber: invoice.invoice_number,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      subject,
      clientName: invoice.client?.name ?? '',
      clientAddress: invoice.client?.address ?? null,
      issuer: ISSUER,
      bank: invoice.bank_name
        ? {
            bank_name: invoice.bank_name,
            bank_branch: invoice.bank_branch,
            bank_account_type: invoice.bank_account_type,
            bank_account_number: invoice.bank_account_number,
            bank_account_holder: invoice.bank_account_holder,
          }
        : DEFAULT_BANK,
      items,
      subtotal: Number(invoice.subtotal),
      discountAmount: Number(invoice.discount_amount),
      taxAmount: Number(invoice.tax_amount),
      totalAmount: Number(invoice.total_amount),
      taxRate: 0.1,
      isTaxExempt: true,
      notes: invoice.notes,
    }

    const buffer = await renderToBuffer(
      React.createElement(InvoicePdfDocument, { data: pdfData }) as unknown as ReactElement,
    )

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(`${invoice.invoice_number}.pdf`)}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('GET /api/invoices/[id]/pdf error:', error)
    const message = error instanceof Error ? error.message : 'unknown'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
