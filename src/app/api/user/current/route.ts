import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/rbac'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      staffId: user.staffId,
      isManager: user.roles.includes('owner') || user.roles.includes('admin'),
    })
  } catch (error) {
    console.error('GET /api/user/current error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
