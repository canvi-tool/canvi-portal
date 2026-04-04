import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, requireAdmin } from '@/lib/auth/rbac'
import { staffFormSchema } from '@/lib/validations/staff'
import { ALLOWED_EMAIL_DOMAINS } from '@/lib/constants'
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
      .is('deleted_at', null)
      .order('start_date', { ascending: false })

    // Fetch portal account info by matching email
    let portalRole: string | null = null
    let hasPortalAccount = false

    const { data: portalUser } = await supabase
      .from('users')
      .select('id, user_roles(roles(name))')
      .eq('email', staff.email)
      .maybeSingle()

    if (portalUser) {
      hasPortalAccount = true
      const roles = (portalUser.user_roles as { roles: { name: string } | null }[])
        ?.map((ur) => ur.roles?.name)
        .filter(Boolean) ?? []
      portalRole = roles[0] || null
    }

    return NextResponse.json({
      ...staff,
      contracts: contracts || [],
      project_assignments: assignments || [],
      portal_role: portalRole,
      has_portal_account: hasPortalAccount,
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

    // --- Portal account: create or update role ---
    const createPortalAccount = body.create_portal_account === true
    const portalRole = body.portal_role as string | undefined
    let portalResult: { success: boolean; message?: string; error?: string } | undefined

    if (portalRole) {
      const adminClient = createAdminClient()
      const staffEmail = formData.email

      // Check if portal user exists
      const { data: existingUser } = await adminClient
        .from('users')
        .select('id')
        .eq('email', staffEmail)
        .maybeSingle()

      if (existingUser) {
        // Update role: remove old roles, add new one
        const { data: newRole } = await adminClient
          .from('roles')
          .select('id')
          .eq('name', portalRole)
          .single()

        if (newRole) {
          // Delete existing roles for this user
          await adminClient
            .from('user_roles')
            .delete()
            .eq('user_id', existingUser.id)

          // Assign new role
          await adminClient.from('user_roles').insert({
            user_id: existingUser.id,
            role_id: newRole.id,
          })

          portalResult = { success: true, message: `ロールを「${portalRole}」に変更しました` }
        }
      } else if (createPortalAccount) {
        // New portal account: invite - canviドメインのメールが必要
        const domain = staffEmail.split('@')[1]?.toLowerCase()
        if (!ALLOWED_EMAIL_DOMAINS.includes(domain ?? '')) {
          portalResult = {
            success: false,
            error: `ポータル招待には @${ALLOWED_EMAIL_DOMAINS[0]} ドメインのメールアドレスが必要です。先にGoogleアカウントを発行するか、メールアドレスを @${ALLOWED_EMAIL_DOMAINS[0]} に変更してください。`,
          }
        } else {
          const { data: inviteData, error: inviteError } =
            await adminClient.auth.admin.inviteUserByEmail(staffEmail, {
              data: {
                display_name: `${formData.last_name} ${formData.first_name}`,
                invited_role: portalRole,
              },
              redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://canvi-portal.vercel.app'}/setup-password`,
            })

          if (inviteError) {
            portalResult = {
              success: false,
              error: inviteError.message?.includes('already been registered')
                ? 'このメールアドレスは既に登録されています'
                : inviteError.message || 'ポータルアカウントの作成に失敗しました',
            }
          } else if (inviteData.user) {
            await adminClient.from('users').upsert(
              {
                id: inviteData.user.id,
                email: staffEmail,
                display_name: `${formData.last_name} ${formData.first_name}`,
              },
              { onConflict: 'id' }
            )

            const { data: roleData } = await adminClient
              .from('roles')
              .select('id')
              .eq('name', portalRole)
              .single()

            if (roleData) {
              await adminClient.from('user_roles').upsert(
                { user_id: inviteData.user.id, role_id: roleData.id },
                { onConflict: 'user_id,role_id' }
              )
            }

            portalResult = { success: true, message: '招待メールを送信しました' }
          }
        }
      }
    }

    return NextResponse.json({
      ...staff,
      ...(portalResult ? { portal: portalResult } : {}),
    })
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

    // Googleアカウント未発行（user_id null）かつオンボーディング中なら物理削除
    const cf = (oldStaff.custom_fields as Record<string, unknown>) || {}
    const isOnboarding = !oldStaff.user_id &&
      ['pending_registration', 'pending_approval'].includes(cf.onboarding_status as string)

    const { error } = isOnboarding
      ? await supabase.from('staff').delete().eq('id', id)
      : await supabase.from('staff').update({
          status: 'retired',
          custom_fields: { ...cf, deleted_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        }).eq('id', id)

    if (error) {
      console.error('Staff delete error:', error)
      return NextResponse.json(
        { error: 'スタッフの削除に失敗しました' },
        { status: 500 }
      )
    }

    // 退職処理: ポータルアカウントを無効化（BAN）
    if (!isOnboarding && oldStaff.email) {
      try {
        const adminClient = createAdminClient()
        const { data: portalUser } = await adminClient
          .from('users')
          .select('id')
          .eq('email', oldStaff.email)
          .maybeSingle()

        if (portalUser) {
          await adminClient.auth.admin.updateUserById(portalUser.id, {
            ban_duration: '876600h', // 100年 = 実質永久BAN
          })
          console.log(`退職処理: ${oldStaff.email} のポータルアカウントを無効化しました`)
        }
      } catch (banErr) {
        console.error('退職時アカウント無効化エラー:', banErr)
        // BAN失敗してもスタッフ削除自体は成功とする
      }
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
