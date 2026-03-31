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
    const googleOrgUnit = body.google_org_unit as string || '/スタッフ'

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
      }
    }

    // ② Supabaseポータルアカウント招待（canviメール宛）
    if (canviEmail) {
      try {
        const adminClient = createAdminClient()
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://canvi-portal.vercel.app'

        const { data: inviteData, error: inviteError } =
          await adminClient.auth.admin.inviteUserByEmail(canviEmail, {
            data: {
              display_name: `${staff.last_name} ${staff.first_name}`,
              invited_role: 'staff',
              needs_password_setup: true,
            },
            redirectTo: `${siteUrl}/setup-password`,
          })

        if (inviteError) {
          results.portal = { success: false, error: inviteError.message }
        } else if (inviteData.user) {
          // usersテーブルにレコード作成
          await adminClient.from('users').upsert(
            {
              id: inviteData.user.id,
              email: canviEmail,
              display_name: `${staff.last_name} ${staff.first_name}`,
            },
            { onConflict: 'id' }
          )

          // staffロール付与
          const { data: roleData } = await adminClient
            .from('roles')
            .select('id')
            .eq('name', 'staff')
            .single()

          if (roleData) {
            await adminClient.from('user_roles').upsert(
              { user_id: inviteData.user.id, role_id: roleData.id },
              { onConflict: 'user_id,role_id' }
            )
          }

          // staffレコードにuser_idを紐付け
          await supabase
            .from('staff')
            .update({ user_id: inviteData.user.id })
            .eq('id', id)

          results.portal = { success: true }
        }
      } catch (err) {
        console.error('Portal invite error:', err)
        results.portal = {
          success: false,
          error: err instanceof Error ? err.message : 'ポータル招待失敗',
        }
      }

      // ③ 個人メール宛にアカウント発行完了通知
      if (staff.personal_email && canviEmail) {
        try {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://canvi-portal.vercel.app'
          const emailContent = buildAccountActivatedEmail({
            staffName: `${staff.last_name} ${staff.first_name}`,
            canviEmail,
            loginUrl: `${siteUrl}/login`,
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
