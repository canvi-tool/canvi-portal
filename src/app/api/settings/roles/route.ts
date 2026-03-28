import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function checkOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { isOwner: false, userId: null }

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id, roles(name)')
    .eq('user_id', user.id)

  const isOwner = userRoles?.some((ur: { roles: { name: string } | null }) => ur.roles?.name === 'owner') ?? false
  return { isOwner, userId: user.id }
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { isOwner } = await checkOwner(supabase)
  if (!isOwner) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  // Fetch all roles
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('*')
    .order('created_at')

  if (rolesError) {
    return NextResponse.json({ error: rolesError.message }, { status: 500 })
  }

  // Fetch all permissions
  const { data: allPermissions, error: permsError } = await supabase
    .from('permissions')
    .select('*')
    .order('resource')
    .order('action')

  if (permsError) {
    return NextResponse.json({ error: permsError.message }, { status: 500 })
  }

  // Fetch role_permissions
  const { data: rolePermissions } = await supabase
    .from('role_permissions')
    .select('role_id, permission_id')

  // Fetch user_roles with user info
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('user_id, role_id, users(id, display_name, email)')

  // Fetch all users for assignment
  const { data: allUsers } = await supabase
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
  const supabase = await createServerSupabaseClient()
  const { isOwner } = await checkOwner(supabase)
  if (!isOwner) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  const body = await request.json()
  const { action } = body

  if (action === 'assign') {
    const { user_id, role_id } = body
    if (!user_id || !role_id) {
      return NextResponse.json({ error: 'user_id と role_id は必須です' }, { status: 400 })
    }

    // Check if already assigned
    const { data: existing } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('user_id', user_id)
      .eq('role_id', role_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'このユーザーには既にこのロールが割り当てられています' }, { status: 400 })
    }

    const { error } = await supabase
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

    const { error } = await supabase
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
    const { data: role } = await supabase
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
      const { error } = await supabase
        .from('role_permissions')
        .insert({ role_id, permission_id })

      if (error) {
        // Ignore duplicate
        if (!error.message.includes('duplicate')) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      }
    } else {
      const { error } = await supabase
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

  return NextResponse.json({ error: '不明なアクションです' }, { status: 400 })
}
