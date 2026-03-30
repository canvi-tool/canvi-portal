import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'
import { generateNextStaffCode } from '@/lib/staff-code'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()
    const nextCode = await generateNextStaffCode(supabase)

    return NextResponse.json({ staff_code: nextCode })
  } catch (err) {
    console.error('Next staff code error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'スタッフコードの生成に失敗しました' },
      { status: 500 }
    )
  }
}
