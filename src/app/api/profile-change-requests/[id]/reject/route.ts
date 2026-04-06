/**
 * POST /api/profile-change-requests/[id]/reject
 * オーナー権限で申請を却下
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const comment = (body.comment as string | undefined) || null

    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from('profile_change_requests')
      .update({
        status: 'REJECTED',
        review_comment: comment,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'PENDING')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('POST reject error:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
