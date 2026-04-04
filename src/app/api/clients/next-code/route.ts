import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'
import { generateNextClientCode } from '@/lib/client-code'

/**
 * GET /api/clients/next-code
 * 次に利用可能なクライアントコードを返す
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()
    const code = await generateNextClientCode(supabase)

    return NextResponse.json({ code })
  } catch (error) {
    console.error('GET /api/clients/next-code error:', error)
    return NextResponse.json(
      { error: 'クライアントコードの生成に失敗しました' },
      { status: 500 }
    )
  }
}
