/**
 * GET  /api/profile-change-requests            - 一覧（admin/owner: 全件, 本人: 自分の申請）
 * POST /api/profile-change-requests            - 新規申請（bodyから staff_id, changes, attachment_urls）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isOwner, hasRole } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  filterEditableChanges,
  computeAttachmentRequirement,
  needsAnyAttachment,
} from '@/lib/profile/change-request-policy'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const admin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = (admin as any).from('profile_change_requests')
      .select('*, staff:staff_id(id, last_name, first_name), requester:requested_by(id, display_name, email)')
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    if (!isOwner(user)) {
      query = query.eq('requested_by', user.id)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (e) {
    console.error('GET /api/profile-change-requests error:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const staffId = body.staff_id as string | undefined
    const rawChanges = (body.changes || {}) as Record<string, { from: unknown; to: unknown }>
    const attachmentUrls = Array.isArray(body.attachment_urls) ? (body.attachment_urls as string[]) : []
    if (!staffId) return NextResponse.json({ error: 'staff_id が必要です' }, { status: 400 })

    const changes = filterEditableChanges(rawChanges)
    const changedKeys = Object.keys(changes)
    if (changedKeys.length === 0) {
      return NextResponse.json({ error: '変更内容がありません（編集不可フィールドのみ）' }, { status: 400 })
    }

    const req = computeAttachmentRequirement(changedKeys)
    if (needsAnyAttachment(req) && attachmentUrls.length === 0) {
      return NextResponse.json(
        { error: '本人確認書類の添付が必要です', requirement: req },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // 既存のPENDINGをCANCELLEDに
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('profile_change_requests')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('staff_id', staffId)
      .eq('status', 'PENDING')

    // 新規INSERT
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).from('profile_change_requests')
      .insert({
        staff_id: staffId,
        requested_by: user.id,
        changes,
        attachment_urls: attachmentUrls,
        requires_identity_doc: req.requiresIdentityDoc,
        requires_address_doc: req.requiresAddressDoc,
        requires_bank_holder_doc: req.requiresBankHolderDoc,
        status: 'PENDING',
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ request: data })
  } catch (e) {
    console.error('POST /api/profile-change-requests error:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
