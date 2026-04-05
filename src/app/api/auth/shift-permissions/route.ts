import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isOwner, hasRole } from '@/lib/auth/rbac'
import { canManageProjectShifts } from '@/lib/auth/project-access'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const projectId = searchParams.get('project_id')

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // project_id が指定されている場合: そのプロジェクトのシフト管理権限を確認
    if (projectId) {
      const { canManage } = await canManageProjectShifts(projectId)
      const role = isOwner(user) ? 'owner' : hasRole(user, 'admin') ? 'admin' : 'staff'
      return NextResponse.json({ canManage, role })
    }

    // project_id なし: グローバルな管理権限（承認待ち一覧ページ用）
    // オーナーまたは管理者であれば管理可能
    const canManage = isOwner(user) || hasRole(user, 'admin')
    const role = isOwner(user) ? 'owner' : hasRole(user, 'admin') ? 'admin' : 'staff'
    return NextResponse.json({ canManage, role })
  } catch (error) {
    console.error('GET /api/auth/shift-permissions error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
