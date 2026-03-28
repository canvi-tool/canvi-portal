import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'
import { contractTemplateFormSchema } from '@/lib/validations/contract'
import type { Json } from '@/lib/types/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const { data: template, error } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !template) {
      return NextResponse.json(
        { error: 'テンプレートが見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json(template)
  } catch (err) {
    console.error('Template GET error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const result = contractTemplateFormSchema.partial().safeParse(body)
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

    const supabase = await createServerSupabaseClient()

    const { data: oldTemplate } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (!oldTemplate) {
      return NextResponse.json(
        { error: 'テンプレートが見つかりません' },
        { status: 404 }
      )
    }

    const formData = result.data
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (formData.name !== undefined) updateData.name = formData.name
    if (formData.description !== undefined) updateData.description = formData.description || null
    if (formData.content_template !== undefined) updateData.content_template = formData.content_template
    if (formData.variables !== undefined) updateData.variables = formData.variables
    if (formData.is_active !== undefined) updateData.is_active = formData.is_active

    const { data: template, error } = await supabase
      .from('contract_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Template update error:', error)
      return NextResponse.json(
        { error: 'テンプレートの更新に失敗しました' },
        { status: 500 }
      )
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'update',
      resource: 'contract_templates',
      resource_id: id,
      old_data: oldTemplate as unknown as Record<string, Json>,
      new_data: template as unknown as Record<string, Json>,
    })

    return NextResponse.json(template)
  } catch (err) {
    console.error('Template PUT error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createServerSupabaseClient()

    // Check if template is used by any contracts
    const { count } = await supabase
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'このテンプレートは契約で使用されているため削除できません。無効化をご利用ください。' },
        { status: 400 }
      )
    }

    const { data: template } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('contract_templates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Template delete error:', error)
      return NextResponse.json(
        { error: 'テンプレートの削除に失敗しました' },
        { status: 500 }
      )
    }

    // Audit log
    if (template) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'delete',
        resource: 'contract_templates',
        resource_id: id,
        old_data: template as unknown as Record<string, Json>,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Template DELETE error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
