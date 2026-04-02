import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'

interface RouteParams {
  params: Promise<{ id: string }>
}

// 署名付きURL有効期限: 10分（マイナンバー法 安全管理措置に基づく最小限のアクセス期間）
const SIGNED_URL_EXPIRY_SECONDS = 600

/** GET: スタッフの本人確認書類の署名付きURLを取得 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // 認可チェック: owner/adminのみ閲覧可能（マイナンバー法の特定個人情報取扱制限）
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    if (!isOwner(user) && !isAdmin(user)) {
      return NextResponse.json(
        { error: '本人確認書類の閲覧は管理者権限が必要です' },
        { status: 403 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // スタッフ取得
    const { data: staff, error } = await supabase
      .from('staff')
      .select('id, custom_fields')
      .eq('id', id)
      .single()

    if (error || !staff) {
      return NextResponse.json({ error: 'スタッフが見つかりません' }, { status: 404 })
    }

    const cf = (staff.custom_fields as Record<string, unknown>) || {}
    const idDoc = cf.identity_document as { type?: string; front?: string; back?: string } | undefined

    if (!idDoc || !idDoc.front || !idDoc.back) {
      return NextResponse.json({ documents: null })
    }

    // 署名付きURLを生成（10分有効 — 最小限のアクセス期間）
    const adminClient = createAdminClient()

    const { data: frontUrl } = await adminClient.storage
      .from('staff-documents')
      .createSignedUrl(idDoc.front, SIGNED_URL_EXPIRY_SECONDS)

    const { data: backUrl } = await adminClient.storage
      .from('staff-documents')
      .createSignedUrl(idDoc.back, SIGNED_URL_EXPIRY_SECONDS)

    // 監査ログ: 本人確認書類へのアクセスを記録（マイナンバー法 アクセス記録義務）
    try {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'export',
        resource: 'staff',
        resource_id: id,
        new_data: JSON.parse(JSON.stringify({
          action: 'view_identity_document',
          document_type: idDoc.type,
          accessed_at: new Date().toISOString(),
        })),
      })
    } catch (auditErr) {
      console.error('Audit log error (document access):', auditErr)
    }

    return NextResponse.json({
      documents: {
        type: idDoc.type || 'unknown',
        frontUrl: frontUrl?.signedUrl || null,
        backUrl: backUrl?.signedUrl || null,
        expiresInSeconds: SIGNED_URL_EXPIRY_SECONDS,
      },
    })
  } catch (err) {
    console.error('Document fetch error:', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
