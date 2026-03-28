import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'
import { contractTemplateFormSchema, contractTemplateSearchSchema } from '@/lib/validations/contract'
import type { Json } from '@/lib/types/database'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const params = contractTemplateSearchSchema.parse({
      search: searchParams.get('search') || undefined,
      is_active: searchParams.get('is_active') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    const supabase = await createServerSupabaseClient()
    let query = supabase
      .from('contract_templates')
      .select('*', { count: 'exact' })

    if (params.search) {
      query = query.or(
        `name.ilike.%${params.search}%,description.ilike.%${params.search}%`
      )
    }

    if (params.is_active === 'true') {
      query = query.eq('is_active', true)
    } else if (params.is_active === 'false') {
      query = query.eq('is_active', false)
    }

    const offset = (params.page - 1) * params.limit
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + params.limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Template list query error:', error)
      return NextResponse.json(
        { error: 'テンプレート一覧の取得に失敗しました' },
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
    console.error('Templates GET error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const result = contractTemplateFormSchema.safeParse(body)

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
      return NextResponse.json(
        { error: 'バリデーションエラー', details: errors },
        { status: 400 }
      )
    }

    const formData = result.data
    const supabase = await createServerSupabaseClient()

    const templateRecord = {
      name: formData.name,
      description: formData.description || null,
      content_template: formData.content_template,
      variables: (formData.variables || []) as unknown as Json,
      is_active: formData.is_active,
      created_by: user.id,
    }

    const { data: template, error } = await supabase
      .from('contract_templates')
      .insert(templateRecord)
      .select()
      .single()

    if (error) {
      console.error('Template create error:', error)
      return NextResponse.json(
        { error: 'テンプレートの作成に失敗しました' },
        { status: 500 }
      )
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'create',
      resource: 'contract_templates',
      resource_id: template.id,
      new_data: template as unknown as Record<string, Json>,
    })

    return NextResponse.json(template, { status: 201 })
  } catch (err) {
    console.error('Templates POST error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
