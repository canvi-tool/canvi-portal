import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'
import { assignRoleSchema, removeRoleSchema } from '@/lib/validations/settings'

/**
 * GET /api/settings/roles
 * 全ロールとそのユーザー一覧、全ユーザー一覧を返す（オーナーのみ）
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (!isOwner(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const admin = createAdminClient()

    // 全ロール取得
    const { data: rolesData, error: rolesError } = await admin
      .from('roles')
      .select('id, name, description')
      .order('name')

    if (rolesError) {
      return NextResponse.json({ error: rolesError.message }, { status: 500 })
    }

    // 全ユーザー取得
    const { data: allUsersData, error: usersError } = await admin
      .from('users')
      .select('id, email, display_name')
      .order('display_name')

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    // 全user_roles取得
    const { data: userRolesData, error: urError } = await admin
      .from('user_roles')
      .select('user_id, role_id')

    if (urError) {
      return NextResponse.json({ error: urError.message }, { status: 500 })
    }

    // ロールごとにユーザーをマッピング
    const userMap = new Map(
      (allUsersData || []).map((u) => [u.id, u])
    )

    const roles = (rolesData || []).map((role) => {
      const roleUserIds = (userRolesData || [])
        .filter((ur) => ur.role_id === role.id)
        .map((ur) => ur.user_id)

      const users = roleUserIds
        .map((uid) => userMap.get(uid))
        .filter(Boolean)

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        users,
      }
    })

    return NextResponse.json({
      roles,
      allUsers: allUsersData || [],
    })
  } catch (error) {
    console.error('GET /api/settings/roles error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

/**
 * POST /api/settings/roles
 * ロールの割り当て・解除（オーナーのみ）
 * actions: assign, remove, bulk_assign, bulk_remove
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (!isOwner(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body
    const admin = createAdminClient()

    switch (action) {
      case 'assign': {
        const parsed = assignRoleSchema.safeParse(body)
        if (!parsed.success) {
          return NextResponse.json({ error: 'バリデーションエラー', details: parsed.error.flatten() }, { status: 400 })
        }
        const { user_id, role_id } = parsed.data
        const { error } = await admin
          .from('user_roles')
          .upsert({ user_id, role_id }, { onConflict: 'user_id,role_id' })

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        return NextResponse.json({ success: true })
      }

      case 'remove': {
        const parsed = removeRoleSchema.safeParse(body)
        if (!parsed.success) {
          return NextResponse.json({ error: 'バリデーションエラー', details: parsed.error.flatten() }, { status: 400 })
        }
        const { user_id, role_id } = parsed.data
        const { error } = await admin
          .from('user_roles')
          .delete()
          .eq('user_id', user_id)
          .eq('role_id', role_id)

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        return NextResponse.json({ success: true })
      }

      case 'bulk_assign': {
        const { user_ids, role_id } = body
        if (!Array.isArray(user_ids) || !role_id) {
          return NextResponse.json({ error: 'user_ids と role_id は必須です' }, { status: 400 })
        }
        const rows = user_ids.map((uid: string) => ({ user_id: uid, role_id }))
        const { error } = await admin
          .from('user_roles')
          .upsert(rows, { onConflict: 'user_id,role_id' })

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        return NextResponse.json({ success: true, count: user_ids.length })
      }

      case 'bulk_remove': {
        const { user_ids, role_id } = body
        if (!Array.isArray(user_ids) || !role_id) {
          return NextResponse.json({ error: 'user_ids と role_id は必須です' }, { status: 400 })
        }
        const { error } = await admin
          .from('user_roles')
          .delete()
          .in('user_id', user_ids)
          .eq('role_id', role_id)

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        return NextResponse.json({ success: true, count: user_ids.length })
      }

      default:
        return NextResponse.json({ error: `不明なアクション: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('POST /api/settings/roles error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
