import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'

const RULE_TYPES = [
  'HOURLY',
  'MONTHLY_FIXED',
  'DAILY',
  'PER_CALL',
  'PER_APPOINTMENT',
  'PER_CLOSING',
  'REVENUE_SHARE',
  'MANAGEMENT_FEE',
  'DISCOUNT_FIXED',
  'DISCOUNT_RATE',
] as const

const createSchema = z.object({
  project_id: z.string().uuid(),
  rule_type: z.enum(RULE_TYPES),
  label: z.string().min(1),
  unit_price: z.number().nullable().optional(),
  rate_percent: z.number().nullable().optional(),
  fixed_amount: z.number().nullable().optional(),
  min_amount: z.number().nullable().optional(),
  max_amount: z.number().nullable().optional(),
  sort_order: z.number().int().optional(),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  notes: z.string().optional(),
})

const updateSchema = createSchema.partial().extend({ id: z.string().uuid() })

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user) && !isAdmin(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    let q = supabase
      .from('project_billing_rules')
      .select('*, project:project_id(id, name)')
      .order('sort_order', { ascending: true })
    if (projectId) q = q.eq('project_id', projectId)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (error) {
    console.error('GET /api/project-billing-rules error:', error)
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
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
    const { data, error } = await supabase
      .from('project_billing_rules')
      .insert({ ...parsed.data, created_by: user.id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('POST /api/project-billing-rules error:', error)
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
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
    const { id, ...patch } = parsed.data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const { data, error } = await supabase
      .from('project_billing_rules')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('PUT /api/project-billing-rules error:', error)
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user) && !isAdmin(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'idが必要です' }, { status: 400 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    // 失効化（effective_to を今日に設定）
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('project_billing_rules')
      .update({ effective_to: today, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/project-billing-rules error:', error)
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
