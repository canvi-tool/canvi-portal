import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, requireAdmin } from '@/lib/auth/rbac'
import { staffFormSchema, staffSearchSchema } from '@/lib/validations/staff'
import { createUser as createGoogleUser } from '@/lib/integrations/google-workspace'
import { createUser as createZoomUser } from '@/lib/integrations/zoom'
import { generateNextStaffCode } from '@/lib/staff-code'
import { ALLOWED_EMAIL_DOMAINS } from '@/lib/constants'
import type { Json } from '@/lib/types/database'

// Vercel Serverless Function のタイムアウトを60秒に延長
// Google Workspace + Zoom + Portal招待の外部API呼び出しに時間がかかるため
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const params = staffSearchSchema.parse({
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      employment_type: searchParams.get('employment_type') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    const supabase = await createServerSupabaseClient()
    let query = supabase
      .from('staff')
      .select('*', { count: 'exact' })

    // Search by name, email, or staff_code
    if (params.search) {
      query = query.or(
        `last_name.ilike.%${params.search}%,first_name.ilike.%${params.search}%,last_name_kana.ilike.%${params.search}%,first_name_kana.ilike.%${params.search}%,email.ilike.%${params.search}%,staff_code.ilike.%${params.search}%`
      )
    }

    if (params.status) {
      query = query.eq('status', params.status)
    }

    if (params.employment_type) {
      query = query.eq('employment_type', params.employment_type)
    }

    const offset = (params.page - 1) * params.limit
    query = query
      .order('staff_code', { ascending: true })
      .range(offset, offset + params.limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Staff list query error:', error)
      return NextResponse.json(
        { error: 'スタッフ一覧の取得に失敗しました' },
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
    console.error('Staff GET error:', err)
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

    // スタッフコードが空 or 未指定の場合は自動採番
    let staffCode = formData.staff_code
    if (!staffCode || staffCode.trim() === '') {
      staffCode = await generateNextStaffCode(supabase)
    }

    // Build the staff record matching the DB schema
    const staffRecord = {
      staff_code: staffCode,
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
      status: 'pre_contract' as const,
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
    }

    const { data: staff, error } = await supabase
      .from('staff')
      .insert(staffRecord)
      .select()
      .single()

    if (error) {
      console.error('Staff create error:', error)
      return NextResponse.json(
        { error: 'スタッフの作成に失敗しました', detail: error.message, code: error.code },
        { status: 500 }
      )
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      user_id: admin.id,
      action: 'create',
      resource: 'staff',
      resource_id: staff.id,
      new_data: staff as unknown as Record<string, Json>,
    })

    // --- External account provisioning ---
    const provisioning: Record<string, { success: boolean; email?: string; error?: string }> = {}

    const createGoogleAccount = body.create_google_account === true
    const createZoomAccount = body.create_zoom_account === true

    // Google Workspace provisioning
    if (createGoogleAccount && body.google_email_prefix) {
      try {
        const googleEmail = `${body.google_email_prefix}@canvi.co.jp`
        const googleUser = await createGoogleUser({
          email: googleEmail,
          givenName: formData.first_name,
          familyName: formData.last_name,
          orgUnitPath: body.google_org_unit || '/スタッフ',
        })
        provisioning.google_workspace = {
          success: true,
          email: googleUser.primaryEmail,
        }
      } catch (err) {
        console.error('Google Workspace provisioning error:', err)
        provisioning.google_workspace = {
          success: false,
          error: err instanceof Error ? err.message : 'Google Workspaceアカウントの作成に失敗しました',
        }
      }
    }

    // Zoom provisioning
    if (createZoomAccount) {
      try {
        // Use Google Workspace email if created, otherwise use staff email
        const zoomEmail = provisioning.google_workspace?.success && provisioning.google_workspace.email
          ? provisioning.google_workspace.email
          : formData.email
        const zoomUser = await createZoomUser({
          email: zoomEmail,
          first_name: formData.first_name,
          last_name: formData.last_name,
          type: body.zoom_license_type || 1,
        })
        provisioning.zoom = {
          success: true,
          email: zoomUser.email,
        }
      } catch (err) {
        console.error('Zoom provisioning error:', err)
        provisioning.zoom = {
          success: false,
          error: err instanceof Error ? err.message : 'Zoomアカウントの作成に失敗しました',
        }
      }
    }

    // --- Portal account provisioning ---
    const createPortalAccount = body.create_portal_account === true
    const portalRole = body.portal_role as string | undefined

    if (createPortalAccount && formData.email) {
      try {
        // ポータル招待にはcanviドメインのメールを使用する
        // Googleアカウントが発行済みならそのメール、なければformData.emailをチェック
        const portalEmail = (provisioning.google_workspace?.success && provisioning.google_workspace.email)
          ? provisioning.google_workspace.email
          : formData.email

        const domain = portalEmail.split('@')[1]?.toLowerCase()
        if (!ALLOWED_EMAIL_DOMAINS.includes(domain ?? '')) {
          provisioning.portal = {
            success: false,
            error: `ポータル招待には @${ALLOWED_EMAIL_DOMAINS[0]} ドメインのメールアドレスが必要です。先にGoogleアカウントを発行してください。`,
          }
        } else {
          const adminClient = createAdminClient()
          const { data: inviteData, error: inviteError } =
            await adminClient.auth.admin.inviteUserByEmail(portalEmail, {
              data: {
                display_name: `${formData.last_name} ${formData.first_name}`,
                invited_role: portalRole || 'staff',
              },
              redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://canvi-portal.vercel.app'}/setup-password`,
            })

          if (inviteError) {
            provisioning.portal = {
              success: false,
              error: inviteError.message?.includes('already been registered')
                ? 'このメールアドレスは既に登録されています'
                : inviteError.message || 'ポータルアカウントの作成に失敗しました',
            }
          } else if (inviteData.user) {
            // Create users record
            await adminClient.from('users').upsert(
              {
                id: inviteData.user.id,
                email: portalEmail,
                display_name: `${formData.last_name} ${formData.first_name}`,
              },
              { onConflict: 'id' }
            )

            // Assign role
            const roleName = portalRole || 'staff'
            const { data: roleData } = await adminClient
              .from('roles')
              .select('id')
              .eq('name', roleName)
              .single()

            if (roleData) {
              await adminClient.from('user_roles').upsert(
                { user_id: inviteData.user.id, role_id: roleData.id },
                { onConflict: 'user_id,role_id' }
              )
            }

            // Link staff to user
            await supabase
              .from('staff')
              .update({ user_id: inviteData.user.id })
              .eq('id', staff.id)

            provisioning.portal = {
              success: true,
              email: portalEmail,
            }
          }
        }
      } catch (err) {
        console.error('Portal account provisioning error:', err)
        provisioning.portal = {
          success: false,
          error: err instanceof Error ? err.message : 'ポータルアカウントの作成に失敗しました',
        }
      }
    }

    const response = {
      ...staff,
      ...(Object.keys(provisioning).length > 0 ? { provisioning } : {}),
    }

    return NextResponse.json(response, { status: 201 })
  } catch (err) {
    console.error('Staff POST error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
