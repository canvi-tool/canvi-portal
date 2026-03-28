import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'
import { contractFormSchema } from '@/lib/validations/contract'
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

    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*, staff(*), template:contract_templates(*)')
      .eq('id', id)
      .single()

    if (error || !contract) {
      return NextResponse.json(
        { error: '契約が見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json(contract)
  } catch (err) {
    console.error('Contract GET error:', err)
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

    // Allow partial updates
    const result = contractFormSchema.partial().safeParse(body)
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

    // Get old data for audit log
    const { data: oldContract } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single()

    if (!oldContract) {
      return NextResponse.json(
        { error: '契約が見つかりません' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const formData = result.data

    if (formData.staff_id !== undefined) updateData.staff_id = formData.staff_id
    if (formData.template_id !== undefined) updateData.template_id = formData.template_id || null
    if (formData.title !== undefined) updateData.title = formData.title
    if (formData.content !== undefined) updateData.content = formData.content || null
    if (formData.status !== undefined) updateData.status = formData.status
    if (formData.start_date !== undefined) updateData.start_date = formData.start_date
    if (formData.end_date !== undefined) updateData.end_date = formData.end_date || null
    if (formData.variables !== undefined) updateData.variables = formData.variables

    // Handle signed_at when status changes to signed
    if (formData.status === 'signed' && oldContract.status !== 'signed') {
      updateData.signed_at = new Date().toISOString()
    }

    const { data: contract, error } = await supabase
      .from('contracts')
      .update(updateData)
      .eq('id', id)
      .select('*, staff(*), template:contract_templates(*)')
      .single()

    if (error) {
      console.error('Contract update error:', error)
      return NextResponse.json(
        { error: '契約の更新に失敗しました' },
        { status: 500 }
      )
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'update',
      resource: 'contracts',
      resource_id: id,
      old_data: oldContract as unknown as Record<string, Json>,
      new_data: contract as unknown as Record<string, Json>,
    })

    return NextResponse.json(contract)
  } catch (err) {
    console.error('Contract PUT error:', err)
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

    // Only allow deleting draft contracts
    const { data: contract } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single()

    if (!contract) {
      return NextResponse.json(
        { error: '契約が見つかりません' },
        { status: 404 }
      )
    }

    if (contract.status !== 'draft') {
      return NextResponse.json(
        { error: '下書き以外の契約は削除できません' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('contracts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Contract delete error:', error)
      return NextResponse.json(
        { error: '契約の削除に失敗しました' },
        { status: 500 }
      )
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'delete',
      resource: 'contracts',
      resource_id: id,
      old_data: contract as unknown as Record<string, Json>,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contract DELETE error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
