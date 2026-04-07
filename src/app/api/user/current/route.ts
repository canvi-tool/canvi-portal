import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // オーナーロールを持つユーザーに紐づく staff_id の一覧
    //   → admin が UI 上でオーナーのシフトを編集できないようにするために利用
    let ownerStaffIds: string[] = []
    try {
      const adminClient = createAdminClient()
      const { data: ownerRole } = await adminClient
        .from('roles')
        .select('id')
        .eq('name', 'owner')
        .single()
      if (ownerRole?.id) {
        const { data: ownerUserRoles } = await adminClient
          .from('user_roles')
          .select('user_id')
          .eq('role_id', ownerRole.id)
        const ownerUserIds = (ownerUserRoles || []).map((r) => r.user_id).filter(Boolean)
        if (ownerUserIds.length > 0) {
          const { data: ownerStaff } = await adminClient
            .from('staff')
            .select('id')
            .in('user_id', ownerUserIds)
          ownerStaffIds = (ownerStaff || []).map((s) => s.id)
        }
      }
    } catch (e) {
      console.error('ownerStaffIds load failed:', e)
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      staffId: user.staffId,
      isManager: user.roles.includes('owner') || user.roles.includes('admin'),
      ownerStaffIds,
    })
  } catch (error) {
    console.error('GET /api/user/current error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
