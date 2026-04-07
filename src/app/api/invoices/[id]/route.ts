import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'
import {
  getInvoice,
  updateInvoice,
  softDeleteInvoice,
} from '@/lib/billing/invoice-service'

const updateSchema = z.object({
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
  sent_to_email: z.string().email().optional(),
  status: z
    .enum(['draft', 'issued', 'sent', 'paid', 'overdue', 'cancelled'])
    .optional(),
  bank_name: z.string().optional(),
  bank_branch: z.string().optional(),
  bank_account_type: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_account_holder: z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user) && !isAdmin(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const data = await getInvoice(supabase, id)
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/invoices/[id] error:', error)
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(
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
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const data = await updateInvoice(supabase, id, { ...parsed.data, user_id: user.id })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('PUT /api/invoices/[id] error:', error)
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) {
      return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    await softDeleteInvoice(supabase, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/invoices/[id] error:', error)
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
