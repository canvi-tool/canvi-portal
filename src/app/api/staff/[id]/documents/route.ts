import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** GET: スタッフの本人確認書類の署名付きURLを取得 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
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

    // 署名付きURLを生成（1時間有効）
    const adminClient = createAdminClient()

    const { data: frontUrl } = await adminClient.storage
      .from('staff-documents')
      .createSignedUrl(idDoc.front, 3600)

    const { data: backUrl } = await adminClient.storage
      .from('staff-documents')
      .createSignedUrl(idDoc.back, 3600)

    return NextResponse.json({
      documents: {
        type: idDoc.type || 'unknown',
        frontUrl: frontUrl?.signedUrl || null,
        backUrl: backUrl?.signedUrl || null,
      },
    })
  } catch (err) {
    console.error('Document fetch error:', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
