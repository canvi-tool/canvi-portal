import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { staffOnboardingSchema, employeeOnboardingSchema, isFreelanceType as isFreelance } from '@/lib/validations/staff'
import { sendEmail, buildApprovalRequestEmail } from '@/lib/email/send'

interface RouteParams {
  params: Promise<{ token: string }>
}

/** GET: トークンの有効性確認 + スタッフ基本情報取得 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const supabase = createAdminClient()

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

    // Content-Type判定: FormDataかJSONか
    const contentType = request.headers.get('content-type') || ''
    let body: Record<string, unknown>
    let idDocType: string | null = null
    let idDocFrontFile: File | null = null
    let idDocBackFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const fd = await request.formData()
      const jsonStr = fd.get('json') as string
      body = JSON.parse(jsonStr)
      idDocType = fd.get('id_doc_type') as string | null
      idDocFrontFile = fd.get('id_doc_front') as File | null
      idDocBackFile = fd.get('id_doc_back') as File | null
    } else {
      body = await request.json()
    }

    // 雇用区分に応じたバリデーション
    const schema = isFreelance(staff.employment_type) ? staffOnboardingSchema : employeeOnboardingSchema
    const result = schema.safeParse(body)

    if (!result.success) {
      console.error('Validation errors:', result.error.issues)
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'バリデーションエラー' },
        { status: 400 }
      )
    }

    const validatedData = result.data
    const existingFields = (staff.custom_fields as Record<string, unknown>) || {}

    // 本人確認書類のアップロード（社員系のみ）
    let idDocPaths: { front?: string; back?: string; type?: string } = {}
    if (!isFreelance(staff.employment_type) && idDocFrontFile && idDocBackFile && idDocType) {
      try {
        const frontExt = idDocFrontFile.name.split('.').pop() || 'jpg'
        const backExt = idDocBackFile.name.split('.').pop() || 'jpg'
        const basePath = `identity-docs/${staff.id}`

        // File → Uint8Array（Vercel Edge/Serverless互換）
        const frontBytes = new Uint8Array(await idDocFrontFile.arrayBuffer())
        const backBytes = new Uint8Array(await idDocBackFile.arrayBuffer())

        const { error: frontErr } = await supabase.storage
          .from('staff-documents')
          .upload(`${basePath}/front.${frontExt}`, frontBytes, {
            contentType: idDocFrontFile.type,
            upsert: true,
          })
        if (frontErr) console.error('Front upload error:', frontErr)

        const { error: backErr } = await supabase.storage
          .from('staff-documents')
          .upload(`${basePath}/back.${backExt}`, backBytes, {
            contentType: idDocBackFile.type,
            upsert: true,
          })
        if (backErr) console.error('Back upload error:', backErr)

        idDocPaths = {
          type: idDocType,
          front: `${basePath}/front.${frontExt}`,
          back: `${basePath}/back.${backExt}`,
        }
      } catch (uploadErr) {
        console.error('ID doc upload error:', uploadErr)
        // アップロード失敗しても登録は続行
      }
    }

    // スタッフレコードを更新
    const { error: updateError } = await supabase
      .from('staff')
      .update({
        last_name: validatedData.last_name,
        first_name: validatedData.first_name,
        last_name_kana: validatedData.last_name_kana || null,
        first_name_kana: validatedData.first_name_kana || null,
        last_name_eiji: validatedData.last_name_eiji || null,
        first_name_eiji: validatedData.first_name_eiji || null,
        date_of_birth: validatedData.date_of_birth || null,
        gender: validatedData.gender || null,
        phone: validatedData.phone || null,
        postal_code: validatedData.postal_code || null,
        prefecture: validatedData.prefecture || null,
        city: validatedData.city || null,
        address_line1: validatedData.address_line1 || null,
        address_line2: validatedData.address_line2 || null,
        bank_name: validatedData.bank_name || null,
        bank_branch: validatedData.bank_branch || null,
        bank_account_type: validatedData.bank_account_type || null,
        bank_account_number: validatedData.bank_account_number || null,
        bank_account_holder: validatedData.bank_account_holder || null,
        emergency_contact_name: validatedData.emergency_contact_name || null,
        emergency_contact_phone: validatedData.emergency_contact_phone || null,
        emergency_contact_relationship: validatedData.emergency_contact_relationship || null,
        custom_fields: {
          ...existingFields,
          onboarding_status: 'pending_approval',
          onboarding_submitted_at: new Date().toISOString(),
          ...(Object.keys(idDocPaths).length > 0 ? { identity_document: idDocPaths } : {}),
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
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://canvi-portal.vercel.app'
        const emailContent = buildApprovalRequestEmail({
          staffName: `${validatedData.last_name} ${validatedData.first_name}`,
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
    return NextResponse.json({ error: `サーバーエラー: ${err instanceof Error ? err.message : '不明'}` }, { status: 500 })
  }
}
