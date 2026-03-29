import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        step: 'auth',
        error: 'No auth user',
        authError: authError?.message,
      })
    }

    // Check users table with normal client
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, display_name, user_roles(role_id, role:roles(id, name))')
      .eq('id', user.id)
      .single()

    // Check with admin client
    const admin = createAdminClient()
    const { data: adminUserData, error: adminUserError } = await admin
      .from('users')
      .select('id, email, display_name, user_roles(role_id, role:roles(id, name))')
      .eq('id', user.id)
      .single()

    // Check user_roles directly
    const { data: directRoles, error: directRolesError } = await admin
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)

    // Check all roles
    const { data: allRoles } = await admin.from('roles').select('*')

    // Check all user_roles
    const { data: allUserRoles } = await admin.from('user_roles').select('*, users(email), roles(name)')

    return NextResponse.json({
      auth_user: { id: user.id, email: user.email },
      users_table: { data: userData, error: userError?.message },
      admin_users_table: { data: adminUserData, error: adminUserError?.message },
      direct_roles: { data: directRoles, error: directRolesError?.message },
      all_roles: allRoles,
      all_user_roles: allUserRoles,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
