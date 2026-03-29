import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 一時的な管理APIエンドポイント: 全権限リセット + オーナー再割当
 * 使用後に削除すること
 */
export async function POST(request: NextRequest) {
  try {
    // セキュリティ: シークレットキーで保護
    const { secret } = await request.json()
    if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-10)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const targetEmail = 'yuji.okabayashi@canvi.co.jp'

    // Step 1: user_roles テーブルを全クリア
    // まず全レコードのuser_idを取得
    const { data: allRoles } = await admin.from('user_roles').select('user_id')
    const allUserIds = [...new Set((allRoles || []).map(r => r.user_id))]

    let deleteError = null
    if (allUserIds.length > 0) {
      const result = await admin
        .from('user_roles')
        .delete()
        .in('user_id', allUserIds)
      deleteError = result.error
    }

    if (deleteError) {
      console.error('Delete user_roles error:', deleteError)
      return NextResponse.json({ error: 'user_roles削除失敗', detail: deleteError.message }, { status: 500 })
    }

    // Step 2: auth.usersからターゲットユーザーを取得
    const { data: { users: authUsers }, error: listError } = await admin.auth.admin.listUsers()
    if (listError) {
      return NextResponse.json({ error: 'auth users取得失敗', detail: listError.message }, { status: 500 })
    }

    const authUser = authUsers.find(u => u.email === targetEmail)
    if (!authUser) {
      return NextResponse.json({ error: `${targetEmail} がauth.usersに見つかりません` }, { status: 404 })
    }

    // Step 3: usersテーブルにレコードがあるか確認、なければ作成
    const { data: existingUser } = await admin
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .maybeSingle()

    if (!existingUser) {
      const { error: insertError } = await admin.from('users').insert({
        id: authUser.id,
        email: targetEmail,
        display_name: authUser.user_metadata?.display_name || authUser.user_metadata?.full_name || '岡林 優治',
      })
      if (insertError) {
        return NextResponse.json({ error: 'users insert失敗', detail: insertError.message }, { status: 500 })
      }
    }

    // Step 4: owner ロールのIDを取得
    const { data: ownerRole, error: roleError } = await admin
      .from('roles')
      .select('id, name')
      .eq('name', 'owner')
      .single()

    if (roleError || !ownerRole) {
      return NextResponse.json({ error: 'ownerロールが見つかりません', detail: roleError?.message }, { status: 500 })
    }

    // Step 5: オーナー権限を割当
    const { error: assignError } = await admin.from('user_roles').insert({
      user_id: authUser.id,
      role_id: ownerRole.id,
    })

    if (assignError) {
      return NextResponse.json({ error: 'ロール割当失敗', detail: assignError.message }, { status: 500 })
    }

    // Step 6: 確認のため再取得
    const { data: verify } = await admin
      .from('users')
      .select(`
        id, email, display_name,
        user_roles(role:roles(name))
      `)
      .eq('id', authUser.id)
      .single()

    return NextResponse.json({
      success: true,
      message: `全権限をリセットし、${targetEmail} にオーナー権限を割り当てました`,
      user: verify,
      auth_user_id: authUser.id,
    })
  } catch (err) {
    console.error('Reset roles error:', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
