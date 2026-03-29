import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, requireAdmin } from '@/lib/auth/rbac'
import { staffFormSchema } from '@/lib/validations/staff'
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

    const { data: staff, error } = await supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !staff) {
      return NextResponse.json(
        { error: 'スタッフが見つかりません' },
        { status: 404 }
      )
    }

    // Fetch related contracts
    const { data: contracts } = await supabase
      .from('contracts')
      .select('*')
      .eq('staff_id', id)
      .order('created_at', { ascending: false })

    // Fetch related project assignments with project info
    const { data: assignments } = await supabase
      .from('project_assignments')
      .select('*, project:projects(*)')
      .eq('staff_id', id)
      .order('start_date', { ascending: false })

    return NextResponse.json({
      ...staff,
      contracts: contracts || [],
      project_assignments: assignments || [],
    })
  } catch (err) {
    console.error('Staff GET detail error:', err)
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
    const result = staffFormSchema.safeParse(body)

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
    const { data: oldStaff } = await supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .single()

    if (!oldStaff) {
      return NextResponse.json(
        { error: 'スタッフが見つかりません' },
        { status: 404 }
      )
    }

    const updateRecord = {
      staff_code: formData.staff_code,
      last_name: formData.last_name,
      first_name: formData.first_name,
      last_name_kana: formData.last_name_kana || null,
      first_name_kana: formData.first_name_kana || null,
      last_name_eiji: formData.last_name_eiji || null,
      first_name_eiji: formData.first_name_eiji || null,
      email: formData.email,
      personal_email: formData.personal_email || null,
      phone: formData.phone || null,
      gender: formData.gender || null,
      date_of_birth: formData.date_of_birth || null,
      postal_code: formData.postal_code || null,
      prefecture: formData.prefecture || null,
      city: formData.city || null,
      address_line1: formData.address_line1 || null,
      address_line2: formData.address_line2 || null,
      employment_type: formData.employment_type,
      hire_date: formData.hire_date || null,
      hourly_rate: formData.hourly_rate ?? null,
      daily_rate: formData.daily_rate ?? null,
      monthly_salary: formData.monthly_salary ?? null,
      transportation_allowance: formData.transportation_allowance ?? null,
      bank_name: formData.bank_name || null,
      bank_branch: formData.bank_branch || null,
      bank_account_type: formData.bank_account_type || null,
      bank_account_number: formData.bank_account_number || null,
      bank_account_holder: formData.bank_account_holder || null,
      notes: formData.notes || null,
      updated_at: new Date().toISOString(),
    }

    const { data: staff, error } = await supabase
      .from('staff')
      .update(updateRecord)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Staff update error:', error)
      return NextResponse.json(
        { error: 'スタッフの更新に失敗しました' },
        { status: 500 }
      )
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      user_id: admin.id,
      action: 'update',
      resource: 'staff',
      resource_id: id,
      old_data: oldStaff as unknown as Record<string, Json>,
      new_data: staff as unknown as Record<string, Json>,
    })

    return NextResponse.json(staff)
  } catch (err) {
    console.error('Staff PUT error:', err)
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
    const { data: oldStaff } = await supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .single()

    if (!oldStaff) {
      return NextResponse.json(
        { error: 'スタッフが見つかりません' },
        { status: 404 }
      )
    }

    // Logical deletion: update status to 'retired' and add a timestamp in custom_fields
    const existingCustom = (oldStaff.custom_fields as Record<string, unknown>) || {}
    const { error } = await supabase
      .from('staff')
      .update({
        status: 'retired',
        custom_fields: {
          ...existingCustom,
          deleted_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      console.error('Staff delete error:', error)
      return NextResponse.json(
        { error: 'スタッフの削除に失敗しました' },
        { status: 500 }
      )
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      user_id: admin.id,
      action: 'delete',
      resource: 'staff',
      resource_id: id,
      old_data: oldStaff as unknown as Record<string, Json>,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Staff DELETE error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
