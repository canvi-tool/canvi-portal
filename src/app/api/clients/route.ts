import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, requireAdmin } from '@/lib/auth/rbac'
import { clientFormSchema, clientSearchSchema } from '@/lib/validations/client'
import type { Json } from '@/lib/types/database'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const params = clientSearchSchema.parse({
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    const supabase = await createServerSupabaseClient()
    let query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)

    // Search by name, name_kana, client_code, contact_person, contact_email
    if (params.search) {
      query = query.or(
        `name.ilike.%${params.search}%,name_kana.ilike.%${params.search}%,client_code.ilike.%${params.search}%,contact_person.ilike.%${params.search}%,contact_email.ilike.%${params.search}%`
      )
    }

    if (params.status) {
      query = query.eq('status', params.status)
    }

    const offset = (params.page - 1) * params.limit
    query = query
      .order('client_code', { ascending: true })
      .range(offset, offset + params.limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Client list query error:', error)
      return NextResponse.json(
        { error: 'クライアント一覧の取得に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page: params.page,
      limit: params.limit,
    })
  } catch (err) {
    console.error('Client GET error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin().catch(() => null)
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const result = clientFormSchema.safeParse(body)

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
      return NextResponse.json({ error: 'バリデーションエラー', details: errors }, { status: 400 })
    }

    const formData = result.data
    const supabase = await createServerSupabaseClient()

    // Build the client record matching the DB schema
    const clientRecord = {
      client_code: formData.client_code,
      name: formData.name,
      name_kana: formData.name_kana || null,
      contact_person: formData.contact_person || null,
      contact_email: formData.contact_email || null,
      contact_phone: formData.contact_phone || null,
      address: formData.address || null,
      industry: formData.industry || null,
      notes: formData.notes || null,
      status: formData.status || 'active',
    }

    const { data: client, error } = await supabase
      .from('clients')
      .insert(clientRecord)
      .select()
      .single()

    if (error) {
      console.error('Client create error:', error)
      return NextResponse.json(
        { error: 'クライアントの作成に失敗しました' },
        { status: 500 }
      )
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      user_id: admin.id,
      action: 'create',
      resource: 'clients',
      resource_id: client.id,
      new_data: client as unknown as Record<string, Json>,
    })

    return NextResponse.json(client, { status: 201 })
  } catch (err) {
    console.error('Client POST error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
