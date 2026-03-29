import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, requireAdmin } from '@/lib/auth/rbac'
import { clientFormSchema } from '@/lib/validations/client'
import type { Json } from '@/lib/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !client) {
      return NextResponse.json(
        { error: 'クライアントが見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json(client)
  } catch (err) {
    console.error('Client GET detail error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin().catch(() => null)
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const { id } = await params
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

    // Fetch current record for audit log
    const { data: oldClient } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!oldClient) {
      return NextResponse.json(
        { error: 'クライアントが見つかりません' },
        { status: 404 }
      )
    }

    const updateRecord = {
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
      updated_at: new Date().toISOString(),
    }

    const { data: client, error } = await supabase
      .from('clients')
      .update(updateRecord)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Client update error:', error)
      return NextResponse.json(
        { error: 'クライアントの更新に失敗しました' },
        { status: 500 }
      )
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      user_id: admin.id,
      action: 'update',
      resource: 'clients',
      resource_id: id,
      old_data: oldClient as unknown as Record<string, Json>,
      new_data: client as unknown as Record<string, Json>,
    })

    return NextResponse.json(client)
  } catch (err) {
    console.error('Client PUT error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin().catch(() => null)
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createServerSupabaseClient()

    // Fetch current record for audit
    const { data: oldClient } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!oldClient) {
      return NextResponse.json(
        { error: 'クライアントが見つかりません' },
        { status: 404 }
      )
    }

    // Soft delete: set deleted_at timestamp
    const { error } = await supabase
      .from('clients')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      console.error('Client delete error:', error)
      return NextResponse.json(
        { error: 'クライアントの削除に失敗しました' },
        { status: 500 }
      )
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      user_id: admin.id,
      action: 'delete',
      resource: 'clients',
      resource_id: id,
      old_data: oldClient as unknown as Record<string, Json>,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Client DELETE error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
