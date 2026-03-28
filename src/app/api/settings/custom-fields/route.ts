import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  createCustomFieldSchema,
  updateCustomFieldSchema,
  reorderCustomFieldsSchema,
  ENTITY_TYPES,
} from '@/lib/validations/settings'

async function checkOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
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
  const supabase = await createServerSupabaseClient()
  const isOwner = await checkOwner(supabase)
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

  const { data: fields, error } = await supabase
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
  const supabase = await createServerSupabaseClient()
  const isOwner = await checkOwner(supabase)
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

  // Check for duplicate field_name within same entity_type
  const { data: existing } = await supabase
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
  const { data: maxOrderRow } = await supabase
    .from('custom_field_definitions')
    .select('sort_order')
    .eq('entity_type', data.entity_type)
    .eq('is_active', true)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxOrderRow?.sort_order ?? -1) + 1

  const { data: created, error } = await supabase
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
  const supabase = await createServerSupabaseClient()
  const isOwner = await checkOwner(supabase)
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

  const { data: updated, error } = await supabase
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
  const supabase = await createServerSupabaseClient()
  const isOwner = await checkOwner(supabase)
  if (!isOwner) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = reorderCustomFieldsSchema.safeParse(body)

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { field_ids } = parsed.data

  // Update sort_order for each field
  const updates = field_ids.map((id, index) =>
    supabase
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
