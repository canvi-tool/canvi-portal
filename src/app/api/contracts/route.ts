import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'
import { contractFormSchema, contractSearchSchema } from '@/lib/validations/contract'
import type { Json } from '@/lib/types/database'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const params = contractSearchSchema.parse({
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    const supabase = await createServerSupabaseClient()
    let query = supabase
      .from('contracts')
      .select('*, staff(*), template:contract_templates(*)', { count: 'exact' })

    if (params.search) {
      query = query.or(
        `title.ilike.%${params.search}%,staff.full_name.ilike.%${params.search}%`
      )
    }

    if (params.status) {
      query = query.eq('status', params.status)
    }

    const offset = (params.page - 1) * params.limit
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + params.limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Contract list query error:', error)
      return NextResponse.json(
        { error: '契約一覧の取得に失敗しました' },
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
    console.error('Contracts GET error:', err)
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
    const result = contractFormSchema.safeParse(body)

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

    const contractRecord = {
      staff_id: formData.staff_id,
      template_id: formData.template_id || null,
      title: formData.title,
      content: formData.content || null,
      status: formData.status || 'draft',
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      variables: (formData.variables || {}) as unknown as Json,
      created_by: user.id,
    }

    const { data: contract, error } = await supabase
      .from('contracts')
      .insert(contractRecord)
      .select('*, staff(*), template:contract_templates(*)')
      .single()

    if (error) {
      console.error('Contract create error:', error)
      return NextResponse.json(
        { error: '契約の作成に失敗しました' },
        { status: 500 }
      )
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'create',
      resource: 'contracts',
      resource_id: contract.id,
      new_data: contract as unknown as Record<string, Json>,
    })

    return NextResponse.json(contract, { status: 201 })
  } catch (err) {
    console.error('Contracts POST error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
