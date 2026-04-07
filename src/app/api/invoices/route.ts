import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'
import { createInvoice, listInvoices } from '@/lib/billing/invoice-service'

const createSchema = z.object({
  project_id: z.string().uuid(),
  client_id: z.string().uuid(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
  sent_to_email: z.string().email().optional(),
  auto_calculate: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (!isOwner(user) && !isAdmin(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const { searchParams } = new URL(request.url)

    const data = await listInvoices(supabase, {
      status: searchParams.get('status') ?? undefined,
      client_id: searchParams.get('client_id') ?? undefined,
      project_id: searchParams.get('project_id') ?? undefined,
      period: searchParams.get('period') ?? undefined,
    })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/invoices error:', error)
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (!isOwner(user) && !isAdmin(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const invoice = await createInvoice(supabase, {
      ...parsed.data,
      user_id: user.id,
    })
    return NextResponse.json({ data: invoice }, { status: 201 })
  } catch (error) {
    console.error('POST /api/invoices error:', error)
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
