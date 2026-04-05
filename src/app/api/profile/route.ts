import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getProjectAccess } from '@/lib/auth/project-access'
import { z } from 'zod'

/**
 * GET /api/profile
 * ログインユーザー自身のスタッフ情報を返す
 */
export async function GET() {
  try {
    const { user, staffId } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (!staffId) {
      return NextResponse.json({ error: 'スタッフ情報が見つかりません' }, { status: 404 })
    }

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('id', staffId)
      .is('deleted_at', null)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'スタッフ情報が見つかりません' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/profile error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

/** 自己更新が許可されたフィールドのバリデーションスキーマ */
const profileUpdateSchema = z.object({
  last_name_kana: z.string().nullable().optional(),
  first_name_kana: z.string().nullable().optional(),
  last_name_eiji: z.string().nullable().optional(),
  first_name_eiji: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  personal_email: z.string().email('メールアドレスの形式が正しくありません').nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  postal_code: z.string().nullable().optional(),
  prefecture: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  address_line1: z.string().nullable().optional(),
  address_line2: z.string().nullable().optional(),
  bank_name: z.string().nullable().optional(),
  bank_branch: z.string().nullable().optional(),
  bank_account_type: z.string().nullable().optional(),
  bank_account_number: z.string().nullable().optional(),
  bank_account_holder: z.string().nullable().optional(),
  emergency_contact_name: z.string().nullable().optional(),
  emergency_contact_phone: z.string().nullable().optional(),
  emergency_contact_relationship: z.string().nullable().optional(),
})

/**
 * PUT /api/profile
 * ログインユーザー自身のスタッフ情報を更新する（許可されたフィールドのみ）
 */
export async function PUT(request: NextRequest) {
  try {
    const { user, staffId } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (!staffId) {
      return NextResponse.json({ error: 'スタッフ情報が見つかりません' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = profileUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // undefined のフィールドを除外して更新データを構築
    const updateData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        updateData[key] = value
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '更新するフィールドがありません' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('staff')
      .update(updateData)
      .eq('id', staffId)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      console.error('PUT /api/profile error:', error)
      return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PUT /api/profile error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
