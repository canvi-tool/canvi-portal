import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

async function checkOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> | null) {
  if (DEMO_MODE) {
    const cookieStore = await cookies()
    const role = cookieStore.get('demo_role')?.value
    return { isOwner: role === 'owner', userId: 'demo-owner' }
  }
  if (!supabase) return { isOwner: false, userId: null }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { isOwner: false, userId: null }

  // Use admin client to check owner role (bypass RLS)
  const admin = createAdminClient()
  const { data: userRoles } = await admin
    .from('user_roles')
    .select('role_id, roles!inner(name)')
    .eq('user_id', user.id)

  const isOwner = userRoles?.some((ur: { roles: { name: string } | null }) => ur.roles?.name === 'owner') ?? false
  return { isOwner, userId: user.id }
}

const DEMO_ROLES = {
  roles: [
    { id: 'role-owner', name: 'owner', description: 'オーナー - 全権限', created_at: '2024-01-01', permissions: [], users: [{ id: 'u1', display_name: '岡林 優治', email: 'okabayashi@canvi.co.jp' }] },
    { id: 'role-admin', name: 'admin', description: '管理者 - 設定以外', created_at: '2024-01-01', permissions: [], users: [{ id: 'u2', display_name: '田中 美咲', email: 'tanaka@canvi.co.jp' }] },
    { id: 'role-staff', name: 'staff', description: 'スタッフ - 閲覧・報告', created_at: '2024-01-01', permissions: [], users: [{ id: 'u3', display_name: '佐藤 健太', email: 'sato@canvi.co.jp' }] },
  ],
  allPermissions: [
    { id: 'p1', resource: 'staff', action: 'read', description: 'スタッフ閲覧' },
    { id: 'p2', resource: 'staff', action: 'write', description: 'スタッフ編集' },
    { id: 'p3', resource: 'projects', action: 'read', description: 'PJ閲覧' },
    { id: 'p4', resource: 'projects', action: 'write', description: 'PJ編集' },
    { id: 'p5', resource: 'settings', action: 'read', description: '設定閲覧' },
    { id: 'p6', resource: 'settings', action: 'write', description: '設定変更' },
  ],
  allUsers: [
    { id: 'u1', display_name: '岡林 優治', email: 'okabayashi@canvi.co.jp' },
    { id: 'u2', display_name: '田中 美咲', email: 'tanaka@canvi.co.jp' },
    { id: 'u3', display_name: '佐藤 健太', email: 'sato@canvi.co.jp' },
  ],
}

export async function GET() {
  const supabase = DEMO_MODE ? null : await createServerSupabaseClient()
  const { isOwner } = await checkOwner(supabase)
  if (!isOwner) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  if (DEMO_MODE) {
    return NextResponse.json(DEMO_ROLES)
  }

  // Use admin client to bypass RLS (owner-only endpoint)
  const admin = createAdminClient()

  // Fetch all roles
  const { data: roles, error: rolesError } = await admin
    .from('roles')
    .select('*')
    .order('created_at')

  if (rolesError) {
    return NextResponse.json({ error: rolesError.message }, { status: 500 })
  }

  // Fetch all permissions
  const { data: allPermissions, error: permsError } = await admin
    .from('permissions')
    .select('*')
    .order('resource')
    .order('action')

  if (permsError) {
    return NextResponse.json({ error: permsError.message }, { status: 500 })
  }

  // Fetch role_permissions
  const { data: rolePermissions } = await admin
    .from('role_permissions')
    .select('role_id, permission_id')

  // Fetch user_roles with user info (specify FK to avoid ambiguity with assigned_by)
  const { data: userRoles } = await admin
    .from('user_roles')
    .select('user_id, role_id, users!user_roles_user_id_fkey(id, display_name, email)')

  // Fetch all users for assignment
  const { data: allUsers } = await admin
    .from('users')
    .select('id, display_name, email')
    .order('display_name')

  // Build response
  const rolesWithPermissions = (roles ?? []).map((role) => {
    const permIds = (rolePermissions ?? [])
      .filter((rp) => rp.role_id === role.id)
      .map((rp) => rp.permission_id)

    const permissions = (allPermissions ?? []).filter((p) =>
      permIds.includes(p.id)
    )

    const users = (userRoles ?? [])
      .filter((ur) => ur.role_id === role.id)
      .map((ur: { user_id: string; users: { id: string; display_name: string; email: string } | null }) => ({
        id: ur.users?.id ?? ur.user_id,
        display_name: ur.users?.display_name ?? '',
        email: ur.users?.email ?? '',
      }))

    return {
      ...role,
      permissions,
      users,
    }
  })

  return NextResponse.json({
    roles: rolesWithPermissions,
    allPermissions: allPermissions ?? [],
    allUsers: allUsers ?? [],
  })
}

export async function POST(request: NextRequest) {
  const supabase = DEMO_MODE ? null : await createServerSupabaseClient()
  const { isOwner } = await checkOwner(supabase)
  if (!isOwner) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  const body = await request.json()
  const { action } = body

  if (DEMO_MODE) {
    return NextResponse.json({ success: true })
  }

  // Use admin client for all write operations (owner-only endpoint, bypass RLS)
  const admin = createAdminClient()

  if (action === 'assign') {
    const { user_id, role_id } = body
    if (!user_id || !role_id) {
      return NextResponse.json({ error: 'user_id と role_id は必須です' }, { status: 400 })
    }

    // Check if already assigned
    const { data: existing } = await admin
      .from('user_roles')
      .select('user_id')
      .eq('user_id', user_id)
      .eq('role_id', role_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'このユーザーには既にこのロールが割り当てられています' }, { status: 400 })
    }

    const { error } = await admin
      .from('user_roles')
      .insert({ user_id, role_id })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (action === 'remove') {
    const { user_id, role_id } = body
    if (!user_id || !role_id) {
      return NextResponse.json({ error: 'user_id と role_id は必須です' }, { status: 400 })
    }

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

  if (action === 'toggle_permission') {
    const { role_id, permission_id, enabled } = body
    if (!role_id || !permission_id || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'role_id, permission_id, enabled は必須です' },
        { status: 400 }
      )
    }

    // Prevent modifying owner role permissions
    const { data: role } = await admin
      .from('roles')
      .select('name')
      .eq('id', role_id)
      .single()

    if (role?.name === 'owner') {
      return NextResponse.json(
        { error: 'オーナーロールの権限は変更できません' },
        { status: 400 }
      )
    }

    if (enabled) {
      const { error } = await admin
        .from('role_permissions')
        .insert({ role_id, permission_id })

      if (error) {
        // Ignore duplicate
        if (!error.message.includes('duplicate')) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      }
    } else {
      const { error } = await admin
        .from('role_permissions')
        .delete()
        .eq('role_id', role_id)
        .eq('permission_id', permission_id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  }

  if (action === 'bulk_assign') {
    const { user_ids, role_id } = body as { user_ids: string[]; role_id: string }
    if (!Array.isArray(user_ids) || user_ids.length === 0 || !role_id) {
      return NextResponse.json({ error: 'user_ids（配列）と role_id は必須です' }, { status: 400 })
    }

    // Prevent assigning owner role
    const { data: role } = await admin
      .from('roles')
      .select('name')
      .eq('id', role_id)
      .single()

    if (role?.name === 'owner') {
      return NextResponse.json({ error: 'オーナーロールは一括割り当てできません' }, { status: 400 })
    }

    const rows = user_ids.map((uid) => ({ user_id: uid, role_id }))
    const { error } = await admin
      .from('user_roles')
      .upsert(rows, { onConflict: 'user_id,role_id' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: user_ids.length })
  }

  if (action === 'bulk_remove') {
    const { user_ids, role_id } = body as { user_ids: string[]; role_id: string }
    if (!Array.isArray(user_ids) || user_ids.length === 0 || !role_id) {
      return NextResponse.json({ error: 'user_ids（配列）と role_id は必須です' }, { status: 400 })
    }

    const { data: role } = await admin
      .from('roles')
      .select('name')
      .eq('id', role_id)
      .single()

    if (role?.name === 'owner') {
      return NextResponse.json({ error: 'オーナーロールは一括解除できません' }, { status: 400 })
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

  return NextResponse.json({ error: '不明なアクションです' }, { status: 400 })
}
