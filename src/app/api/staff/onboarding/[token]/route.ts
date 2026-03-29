import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { staffOnboardingSchema, employeeOnboardingSchema, isEmployeeType } from '@/lib/validations/staff'
import { sendEmail, buildApprovalRequestEmail } from '@/lib/email/send'

interface RouteParams {
  params: Promise<{ token: string }>
}

/** GET: トークンの有効性確認 + スタッフ基本情報取得 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const supabase = createAdminClient()

    // suspended状態でonboarding_tokenが一致するスタッフを検索
    const { data: allSuspended } = await supabase
      .from('staff')
      .select('id, last_name, first_name, personal_email, employment_type, status, custom_fields')
      .eq('status', 'suspended')

    const staff = allSuspended?.find((s) => {
      const fields = s.custom_fields as Record<string, unknown> | null
      return fields?.onboarding_token === token && fields?.onboarding_status === 'pending_registration'
    })

    if (!staff) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 404 })
    }

    return NextResponse.json({
      id: staff.id,
      last_name: staff.last_name,
      first_name: staff.first_name,
      personal_email: staff.personal_email,
      employment_type: staff.employment_type,
    })
  } catch (err) {
    console.error('Onboarding GET error:', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

/** POST: スタッフが必要事項を入力して送信 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const supabase = createAdminClient()

    // トークンでスタッフ検索
    const { data: allSuspended } = await supabase
      .from('staff')
      .select('*')
      .eq('status', 'suspended')

    const staff = allSuspended?.find((s) => {
      const fields = s.custom_fields as Record<string, unknown> | null
      return fields?.onboarding_token === token && fields?.onboarding_status === 'pending_registration'
    })

    if (!staff) {
      return NextResponse.json({ error: 'このリンクは無効または期限切れです' }, { status: 404 })
    }

    const body = await request.json()
    // 雇用区分に応じたバリデーション
    const schema = isEmployeeType(staff.employment_type) ? employeeOnboardingSchema : staffOnboardingSchema
    const result = schema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'バリデーションエラー' },
        { status: 400 }
      )
    }

    const formData = result.data
    const existingFields = (staff.custom_fields as Record<string, unknown>) || {}

    // スタッフレコードを更新（statusはsuspendedのまま、onboarding_statusで管理）
    const { error: updateError } = await supabase
      .from('staff')
      .update({
        last_name: formData.last_name,
        first_name: formData.first_name,
        last_name_kana: formData.last_name_kana || null,
        first_name_kana: formData.first_name_kana || null,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || null,
        phone: formData.phone || null,
        postal_code: formData.postal_code || null,
        prefecture: formData.prefecture || null,
        city: formData.city || null,
        address_line1: formData.address_line1 || null,
        address_line2: formData.address_line2 || null,
        bank_name: formData.bank_name || null,
        bank_branch: formData.bank_branch || null,
        bank_account_type: formData.bank_account_type || null,
        bank_account_number: formData.bank_account_number || null,
        bank_account_holder: formData.bank_account_holder || null,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        custom_fields: {
          ...existingFields,
          onboarding_status: 'pending_approval',
          onboarding_submitted_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', staff.id)

    if (updateError) {
      console.error('Onboarding update error:', updateError)
      return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
    }

    // オーナーに承認依頼メールを送信
    try {
      const { data: allUserRoles } = await supabase
        .from('user_roles')
        .select('user_id, role:roles(name)')

      const ownerUserIds = (allUserRoles ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((ur: any) => ur.role?.name === 'owner')
        .map((ur) => ur.user_id)

      if (ownerUserIds.length > 0) {
        const { data: owners } = await supabase
          .from('users')
          .select('email')
          .in('id', ownerUserIds)

        const ownerEmails = owners?.map((u) => u.email) ?? []
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://canvi-portal-b9br.vercel.app'
        const emailContent = buildApprovalRequestEmail({
          staffName: `${formData.last_name} ${formData.first_name}`,
          approvalUrl: `${siteUrl}/staff/${staff.id}`,
        })

        for (const ownerEmail of ownerEmails) {
          await sendEmail({ to: ownerEmail, ...emailContent }).catch((e) =>
            console.error('Approval email error:', e)
          )
        }
      }
    } catch (emailErr) {
      console.error('Approval notification error:', emailErr)
    }

    return NextResponse.json({
      message: '登録が完了しました。承認をお待ちください。',
    })
  } catch (err) {
    console.error('Onboarding POST error:', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
