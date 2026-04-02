import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'

/**
 * GET: マイナンバー担当者一覧を取得
 * ownerのみアクセス可能
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || !isOwner(user)) {
      return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // my_number/read 権限のIDを取得
    const { data: perm } = await adminClient
      .from('permissions')
      .select('id')
      .eq('resource', 'my_number')
      .eq('action', 'read')
      .single()

    if (!perm) {
      return NextResponse.json({ handlers: [] })
    }

    // user_permissionsは新テーブル（型未定義）
    {
      const { data: rawHandlers } = await adminClient
        .from('user_permissions' as never)
        .select('user_id, granted_at, reason, expires_at')
        .eq('permission_id' as never, perm.id) as { data: Array<{ user_id: string; granted_at: string; reason: string; expires_at: string | null }> | null }

      if (!rawHandlers || rawHandlers.length === 0) {
        return NextResponse.json({ handlers: [] })
      }

      // ユーザー情報を個別取得
      const userIds = rawHandlers.map((h) => h.user_id)
      const { data: users } = await adminClient
        .from('users')
        .select('id, email, display_name')
        .in('id', userIds)

      const userMap = new Map((users || []).map((u) => [u.id, u]))

      return NextResponse.json({
        handlers: rawHandlers.map((h) => {
          const u = userMap.get(h.user_id)
          return {
            userId: h.user_id,
            email: u?.email || null,
            displayName: u?.display_name || null,
            grantedAt: h.granted_at,
            reason: h.reason,
            expiresAt: h.expires_at,
          }
        }),
      })
    }
  } catch (err) {
    console.error('My number handlers GET error:', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

/**
 * POST: マイナンバー担当者を追加
 * ownerのみ実行可能
 * body: { userId: string, reason: string, expiresAt?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !isOwner(user)) {
      return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, reason, expiresAt } = body as {
      userId: string
      reason: string
      expiresAt?: string
    }

    if (!userId || !reason) {
      return NextResponse.json(
        { error: '担当者のユーザーIDと付与理由は必須です' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // my_number/read 権限のIDを取得
    const { data: perm } = await adminClient
      .from('permissions')
      .select('id')
      .eq('resource', 'my_number')
      .eq('action', 'read')
      .single()

    if (!perm) {
      return NextResponse.json(
        { error: 'マイナンバー権限が未設定です。マイグレーション00020を実行してください。' },
        { status: 500 }
      )
    }

    // 担当者を追加
    const { error } = await adminClient
      .from('user_permissions' as never)
      .upsert({
        user_id: userId,
        permission_id: perm.id,
        granted_by: user.id,
        reason,
        expires_at: expiresAt || null,
      } as never, { onConflict: 'user_id,permission_id' } as never) as { error: { message: string } | null }

    if (error) {
      console.error('My number handler add error:', error)
      return NextResponse.json({ error: '担当者の追加に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ message: 'マイナンバー担当者を追加しました' })
  } catch (err) {
    console.error('My number handlers POST error:', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

/**
 * DELETE: マイナンバー担当者を解除
 * ownerのみ実行可能
 * body: { userId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !isOwner(user)) {
      return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const { userId } = body as { userId: string }

    if (!userId) {
      return NextResponse.json({ error: 'ユーザーIDは必須です' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data: perm } = await adminClient
      .from('permissions')
      .select('id')
      .eq('resource', 'my_number')
      .eq('action', 'read')
      .single()

    if (!perm) {
      return NextResponse.json({ error: 'マイナンバー権限が未設定です' }, { status: 500 })
    }

    const { error } = await adminClient
      .from('user_permissions' as never)
      .delete()
      .eq('user_id' as never, userId)
      .eq('permission_id' as never, perm.id) as { error: { message: string } | null }

    if (error) {
      console.error('My number handler remove error:', error)
      return NextResponse.json({ error: '担当者の解除に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ message: 'マイナンバー担当者を解除しました' })
  } catch (err) {
    console.error('My number handlers DELETE error:', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
