import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/rbac'
import { createUser as createGoogleUser, resolveAvailableEmail } from '@/lib/integrations/google-workspace'
import { sendEmail, buildAccountActivatedEmail } from '@/lib/email/send'
import type { Json } from '@/lib/types/database'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin().catch(() => null)
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const googleEmailPrefix = body.google_email_prefix as string | undefined
    const googleOrgUnit = body.google_org_unit as string || '/'
    const portalRole = (body.portal_role as string) || 'staff'

    const supabase = await createServerSupabaseClient()

    // スタッフ取得
    const { data: staff, error: fetchError } = await supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !staff) {
      return NextResponse.json({ error: 'スタッフが見つかりません' }, { status: 404 })
    }

    // suspended + custom_fields.onboarding_status === 'pending_approval' で承認待ちを判定
    const cf = (staff.custom_fields as Record<string, unknown>) || {}
    const isPendingApproval =
      (staff.status === 'suspended' && cf.onboarding_status === 'pending_approval') ||
      staff.status === 'pending_approval'

    if (!isPendingApproval) {
      return NextResponse.json(
        { error: 'このスタッフは承認待ち状態ではありません' },
        { status: 400 }
      )
    }

    const results: {
      google?: { success: boolean; email?: string; error?: string }
      portal?: { success: boolean; error?: string }
    } = {}

    let canviEmail = ''

    // 電話番号下4桁から初期パスワード生成: Canvi + 下4桁 + ca
    const phoneDigits = staff.phone ? String(staff.phone).replace(/\D/g, '').slice(-4) : '0000'
    const initialPassword = `Canvi${phoneDigits.padStart(4, '0')}ca`

    // ① Google Workspaceアカウント作成（重複時は自動採番）
    if (googleEmailPrefix) {
      try {
        const domain = process.env.GOOGLE_WORKSPACE_DOMAIN || 'canvi.co.jp'
        // 重複チェック: prefix@domain → prefix002@domain → prefix003@domain ...
        const { email: resolvedEmail, suffix } = await resolveAvailableEmail(googleEmailPrefix, domain)
        canviEmail = resolvedEmail

        const googleUser = await createGoogleUser({
          email: canviEmail,
          givenName: staff.first_name,
          familyName: staff.last_name,
          password: initialPassword,
          orgUnitPath: googleOrgUnit,
        })
        results.google = {
          success: true,
          email: googleUser.primaryEmail,
          ...(suffix ? { note: `同名ユーザーが存在するため ${suffix} を付与しました` } : {}),
        } as { success: boolean; email?: string; error?: string }
        canviEmail = googleUser.primaryEmail
      } catch (err) {
        console.error('Google account creation error:', err)
        results.google = {
          success: false,
          error: err instanceof Error ? err.message : 'Googleアカウント作成失敗',
        }
        // Google作成失敗時はcanviEmailをクリア（後続処理で誤ってこのメールを使わないように）
        canviEmail = ''
      }
    }

    // ② Supabaseポータルアカウント作成（パスワード指定）
    if (canviEmail) {
      try {
        const adminClient = createAdminClient()

        // パスワード付きでユーザーを直接作成（招待メール不要）
        const { data: createData, error: createError } =
          await adminClient.auth.admin.createUser({
            email: canviEmail,
            password: initialPassword,
            email_confirm: true,
            user_metadata: {
              display_name: `${staff.last_name} ${staff.first_name}`,
              invited_role: 'staff',
              needs_password_setup: true,
              needs_google_link: true,
            },
          })

        if (createError) {
          results.portal = { success: false, error: createError.message }
        } else if (createData.user) {
          // usersテーブルにレコード作成
          await adminClient.from('users').upsert(
            {
              id: createData.user.id,
              email: canviEmail,
              display_name: `${staff.last_name} ${staff.first_name}`,
            },
            { onConflict: 'id' }
          )

          // ポータルロール付与（承認時に選択されたロール）
          const validRoles = ['owner', 'admin', 'staff']
          const roleName = validRoles.includes(portalRole) ? portalRole : 'staff'
          const { data: roleData } = await adminClient
            .from('roles')
            .select('id')
            .eq('name', roleName)
            .single()

          if (roleData) {
            await adminClient.from('user_roles').upsert(
              { user_id: createData.user.id, role_id: roleData.id },
              { onConflict: 'user_id,role_id' }
            )
          }

          // staffレコードにuser_idを紐付け
          await supabase
            .from('staff')
            .update({ user_id: createData.user.id })
            .eq('id', id)

          results.portal = { success: true }
        }
      } catch (err) {
        console.error('Portal create error:', err)
        results.portal = {
          success: false,
          error: err instanceof Error ? err.message : 'ポータルアカウント作成失敗',
        }
      }

      // ③ 個人メール宛にアカウント発行完了通知（パスワード付き）
      if (staff.personal_email && canviEmail) {
        try {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://canvi-portal.vercel.app'
          const emailContent = buildAccountActivatedEmail({
            staffName: `${staff.last_name} ${staff.first_name}`,
            canviEmail,
            loginUrl: `${siteUrl}/login`,
            initialPassword,
          })
          await sendEmail({ to: staff.personal_email, ...emailContent })
        } catch (emailErr) {
          console.error('Activation email error:', emailErr)
        }
      }
    }

    // ④ スタッフレコード更新（承認完了）
    const nextStaffCode = body.staff_code as string | undefined

    const { error: updateError } = await supabase
      .from('staff')
      .update({
        status: 'active',
        email: canviEmail || staff.email,
        ...(nextStaffCode ? { staff_code: nextStaffCode } : {}),
        custom_fields: {
          ...cf,
          onboarding_status: 'completed',
          approved_at: new Date().toISOString(),
          approved_by: admin.id,
          google_email: canviEmail || null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Staff approval update error:', updateError)
      return NextResponse.json({ error: 'スタッフ承認更新に失敗しました' }, { status: 500 })
    }

    // 監査ログ
    await supabase.from('audit_logs').insert({
      user_id: admin.id,
      action: 'update',
      resource: 'staff',
      resource_id: id,
      new_data: {
        action: 'approve_onboarding',
        google_email: canviEmail,
        results,
      } as unknown as Record<string, Json>,
    })

    return NextResponse.json({
      message: '承認が完了しました',
      google_email: canviEmail || null,
      results,
    })
  } catch (err) {
    console.error('Staff approve error:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
