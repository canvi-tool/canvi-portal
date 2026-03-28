import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import {
  createCustomFieldSchema,
  updateCustomFieldSchema,
  reorderCustomFieldsSchema,
  ENTITY_TYPES,
} from '@/lib/validations/settings'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const demoCustomFields = [
  {
    id: 'cf-001', entity_type: 'staff', field_name: 'staff_code',
    field_label: 'スタッフコード', field_type: 'text', options: null,
    is_required: true, sort_order: 0, is_active: true,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cf-002', entity_type: 'staff', field_name: 'department',
    field_label: '部署', field_type: 'select',
    options: ['営業部', '管理部', '開発部', 'カスタマーサポート'],
    is_required: false, sort_order: 1, is_active: true,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cf-003', entity_type: 'project', field_name: 'client_industry',
    field_label: 'クライアント業種', field_type: 'select',
    options: ['IT', '金融', '不動産', '人材', '医療', 'その他'],
    is_required: false, sort_order: 0, is_active: true,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cf-004', entity_type: 'contract', field_name: 'contract_category',
    field_label: '契約カテゴリ', field_type: 'select',
    options: ['業務委託', '派遣', 'SES', 'コンサルティング'],
    is_required: false, sort_order: 0, is_active: true,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  },
]

async function checkOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  if (DEMO_MODE) {
    const cookieStore = await cookies()
    const role = cookieStore.get('demo_role')?.value
    return role === 'owner'
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id, roles(name)')
    .eq('user_id', user.id)

  return userRoles?.some((ur: { roles: { name: string } | null }) => ur.roles?.name === 'owner') ?? false
}

export async function GET(request: NextRequest) {
  const supabase = DEMO_MODE ? null : await createServerSupabaseClient()
  const isOwner = await checkOwner(supabase as never)
  if (!isOwner) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get('entity_type')

  if (!entityType || !(ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return NextResponse.json(
      { error: '有効なエンティティタイプを指定してください' },
      { status: 400 }
    )
  }

  if (DEMO_MODE) {
    return NextResponse.json({ fields: demoCustomFields.filter(f => f.entity_type === entityType) })
  }

  const { data: fields, error } = await supabase!
    .from('custom_field_definitions')
    .select('*')
    .eq('entity_type', entityType)
    .order('is_active', { ascending: false })
    .order('sort_order')
    .order('created_at')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fields: fields ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = DEMO_MODE ? null : await createServerSupabaseClient()
  const isOwner = await checkOwner(supabase as never)
  if (!isOwner) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createCustomFieldSchema.safeParse(body)

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const data = parsed.data

  if (DEMO_MODE) {
    return NextResponse.json({
      field: { id: `cf-${Date.now()}`, ...data, sort_order: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    }, { status: 201 })
  }

  // Check for duplicate field_name within same entity_type
  const { data: existing } = await supabase!
    .from('custom_field_definitions')
    .select('id')
    .eq('entity_type', data.entity_type)
    .eq('field_name', data.field_name)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'このフィールドキーは既に使用されています' },
      { status: 400 }
    )
  }

  // Get max sort_order for this entity type
  const { data: maxOrderRow } = await supabase!
    .from('custom_field_definitions')
    .select('sort_order')
    .eq('entity_type', data.entity_type)
    .eq('is_active', true)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxOrderRow?.sort_order ?? -1) + 1

  const { data: created, error } = await supabase!
    .from('custom_field_definitions')
    .insert({
      entity_type: data.entity_type,
      field_name: data.field_name,
      field_label: data.field_label,
      field_type: data.field_type,
      options: data.options ?? null,
      is_required: data.is_required,
      sort_order: nextOrder,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ field: created }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const supabase = DEMO_MODE ? null : await createServerSupabaseClient()
  const isOwner = await checkOwner(supabase as never)
  if (!isOwner) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateCustomFieldSchema.safeParse(body)

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { id, ...updateData } = parsed.data

  if (DEMO_MODE) {
    return NextResponse.json({ field: { id, ...updateData, updated_at: new Date().toISOString() } })
  }

  // Build update object, only include defined fields
  const updateObj: Record<string, unknown> = {}
  if (updateData.field_label !== undefined) updateObj.field_label = updateData.field_label
  if (updateData.field_type !== undefined) updateObj.field_type = updateData.field_type
  if (updateData.options !== undefined) updateObj.options = updateData.options
  if (updateData.is_required !== undefined) updateObj.is_required = updateData.is_required
  if (updateData.sort_order !== undefined) updateObj.sort_order = updateData.sort_order
  if (updateData.is_active !== undefined) updateObj.is_active = updateData.is_active

  if (Object.keys(updateObj).length === 0) {
    return NextResponse.json({ error: '更新するフィールドがありません' }, { status: 400 })
  }

  const { data: updated, error } = await supabase!
    .from('custom_field_definitions')
    .update(updateObj)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ field: updated })
}

// PATCH - Reorder fields
export async function PATCH(request: NextRequest) {
  const supabase = DEMO_MODE ? null : await createServerSupabaseClient()
  const isOwner = await checkOwner(supabase as never)
  if (!isOwner) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = reorderCustomFieldsSchema.safeParse(body)

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  if (DEMO_MODE) {
    return NextResponse.json({ success: true })
  }

  const { field_ids } = parsed.data

  // Update sort_order for each field
  const updates = field_ids.map((id, index) =>
    supabase!
      .from('custom_field_definitions')
      .update({ sort_order: index })
      .eq('id', id)
  )

  const results = await Promise.all(updates)
  const hasError = results.find((r) => r.error)
  if (hasError?.error) {
    return NextResponse.json({ error: hasError.error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
