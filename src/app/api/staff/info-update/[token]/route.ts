import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { staffOnboardingSchema, employeeOnboardingSchema, isFreelanceType as isFreelance } from '@/lib/validations/staff'

interface RouteParams {
  params: Promise<{ token: string }>
}

/** トークンからスタッフを検索 */
async function findStaffByInfoUpdateToken(token: string) {
  const supabase = createAdminClient()

  // 全スタッフからinfo_update_tokenでマッチするものを検索
  const { data: allStaff } = await supabase
    .from('staff')
    .select('*')

  if (!allStaff) return null

  const staff = allStaff.find((s) => {
    const cf = s.custom_fields as Record<string, unknown> | null
    return cf?.info_update_token === token
  })

  if (!staff) return null

  // 有効期限チェック
  const cf = staff.custom_fields as Record<string, unknown>
  const expiresAt = cf.info_update_expires_at as string | undefined
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return null // 期限切れ
  }

  // 既に完了済みかチェック
  if (cf.info_update_completed_at) {
    return { staff, completed: true }
  }

  return { staff, completed: false }
}

/** GET: トークンの有効性確認 + 既存データをプリフィルで返す */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const result = await findStaffByInfoUpdateToken(token)

    if (!result) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 404 })
    }

    if (result.completed) {
      return NextResponse.json({ error: 'already_completed' }, { status: 410 })
    }

    const { staff } = result

    // 既存データをプリフィル用に返す
    return NextResponse.json({
      id: staff.id,
      last_name: staff.last_name || '',
      first_name: staff.first_name || '',
      last_name_kana: staff.last_name_kana || '',
      first_name_kana: staff.first_name_kana || '',
      last_name_eiji: staff.last_name_eiji || '',
      first_name_eiji: staff.first_name_eiji || '',
      date_of_birth: staff.date_of_birth || '',
      gender: staff.gender || '',
      phone: staff.phone || '',
      postal_code: staff.postal_code || '',
      prefecture: staff.prefecture || '',
      city: staff.city || '',
      address_line1: staff.address_line1 || '',
      address_line2: staff.address_line2 || '',
      bank_name: staff.bank_name || '',
      bank_branch: staff.bank_branch || '',
      bank_account_type: staff.bank_account_type || '',
      bank_account_number: staff.bank_account_number || '',
      bank_account_holder: staff.bank_account_holder || '',
      emergency_contact_name: staff.emergency_contact_name || '',
      emergency_contact_phone: staff.emergency_contact_phone || '',
      emergency_contact_relationship: staff.emergency_contact_relationship || '',
      personal_email: staff.personal_email || '',
      email: staff.email || '',
      employment_type: staff.employment_type,
    })
  } catch (err) {
    console.error('Info update GET error:', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

/** POST: スタッフ情報を更新 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const result = await findStaffByInfoUpdateToken(token)

    if (!result) {
      return NextResponse.json({ error: 'このリンクは無効または期限切れです' }, { status: 404 })
    }

    if (result.completed) {
      return NextResponse.json({ error: 'この情報更新は既に完了しています' }, { status: 410 })
    }

    const { staff } = result
    const supabase = createAdminClient()

    // Content-Type判定
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

    // バリデーション
    const schema = isFreelance(staff.employment_type) ? staffOnboardingSchema : employeeOnboardingSchema
    const validationResult = schema.safeParse(body)

    if (!validationResult.success) {
      console.error('Validation errors:', validationResult.error.issues)
      return NextResponse.json(
        { error: validationResult.error.issues[0]?.message || 'バリデーションエラー' },
        { status: 400 }
      )
    }

    const validatedData = validationResult.data
    const existingFields = (staff.custom_fields as Record<string, unknown>) || {}

    // 業務委託以外は本人確認書類を必須チェック（既にアップロード済みでなければ）
    const existingIdDoc = (existingFields.identity_document as Record<string, unknown> | undefined)
    if (!isFreelance(staff.employment_type) && !existingIdDoc) {
      if (!idDocFrontFile || !idDocBackFile || !idDocType) {
        return NextResponse.json(
          { error: '本人確認書類（表面・裏面）のアップロードは必須です' },
          { status: 400 }
        )
      }
    }

    // 本人確認書類のアップロード（業務委託以外でファイルがある場合）
    let idDocPaths: { front?: string; back?: string; type?: string } = {}
    if (!isFreelance(staff.employment_type) && idDocFrontFile && idDocBackFile && idDocType) {
      try {
        const frontExt = idDocFrontFile.name.split('.').pop() || 'jpg'
        const backExt = idDocBackFile.name.split('.').pop() || 'jpg'
        const basePath = `identity-docs/${staff.id}`

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
          info_update_completed_at: new Date().toISOString(),
          ...(Object.keys(idDocPaths).length > 0 ? { identity_document: idDocPaths } : {}),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', staff.id)

    if (updateError) {
      console.error('Info update error:', updateError)
      return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({
      message: '情報の更新が完了しました。ありがとうございます。',
    })
  } catch (err) {
    console.error('Info update POST error:', err)
    return NextResponse.json({ error: `サーバーエラー: ${err instanceof Error ? err.message : '不明'}` }, { status: 500 })
  }
}
