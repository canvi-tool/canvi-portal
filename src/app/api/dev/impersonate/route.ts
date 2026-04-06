import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEV_EMAILS } from '@/lib/auth/rbac'

const COOKIE_NAME = 'dev_user_override'

async function assertDev() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email || !DEV_EMAILS.includes(user.email)) {
    return null
  }
  return user
}

// GET: 切替可能なユーザー一覧
export async function GET() {
  const devUser = await assertDev()
  if (!devUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('users')
    .select(`
      id, email, display_name,
      user_roles!user_roles_user_id_fkey(role:roles(name))
    `)
    .order('display_name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const users = (data || []).map((u) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roles = ((u.user_roles as any[]) || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((ur: any) => ur.role?.name as string)
      .filter(Boolean) as string[]
    const topRole = roles.includes('owner') ? 'オーナー' : roles.includes('admin') ? '管理者' : 'メンバー'
    return {
      id: u.id,
      email: u.email,
      displayName: u.display_name || u.email,
      role: topRole,
    }
  })

  const cookieStore = await cookies()
  const current = cookieStore.get(COOKIE_NAME)?.value || devUser.id

  return NextResponse.json({ users, currentId: current, realId: devUser.id })
}

// POST: インパーソネート開始 { userId }
export async function POST(request: NextRequest) {
  const devUser = await assertDev()
  if (!devUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await request.json().catch(() => ({}))
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const cookieStore = await cookies()
  if (userId === devUser.id) {
    cookieStore.delete(COOKIE_NAME)
  } else {
    cookieStore.set(COOKIE_NAME, userId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
      sameSite: 'lax',
    })
  }

  return NextResponse.json({ success: true })
}

// DELETE: インパーソネート解除
export async function DELETE() {
  const devUser = await assertDev()
  if (!devUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  return NextResponse.json({ success: true })
}
