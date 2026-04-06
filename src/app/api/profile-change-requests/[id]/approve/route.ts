/**
 * POST /api/profile-change-requests/[id]/approve
 * オーナー権限でプロフィール変更申請を承認→staffテーブルへapply
 * 緊急連絡先変更時は staff_emergency_contacts に履歴行を追加
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, isOwner } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { EMERGENCY_CONTACT_FIELDS, READONLY_FIELDS } from '@/lib/profile/change-request-policy'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user)) return NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 })

    const admin = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: req, error: rErr } = await (admin as any).from('profile_change_requests')
      .select('*')
      .eq('id', id)
      .eq('status', 'PENDING')
      .maybeSingle()
    if (rErr || !req) {
      return NextResponse.json({ error: '申請が見つかりません（既に処理済みの可能性）' }, { status: 404 })
    }

    const changes = (req.changes || {}) as Record<string, { from: unknown; to: unknown }>

    // staffテーブルへのupdate: 編集可フィールド + 緊急連絡先以外
    const staffUpdate: Record<string, unknown> = {}
    const emergencyUpdate: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(changes)) {
      if (READONLY_FIELDS.has(k)) continue
      if (EMERGENCY_CONTACT_FIELDS.has(k)) {
        emergencyUpdate[k] = v.to
      } else {
        staffUpdate[k] = v.to
      }
    }

    if (Object.keys(staffUpdate).length > 0) {
      staffUpdate.updated_at = new Date().toISOString()
      const { error: sErr } = await admin.from('staff').update(staffUpdate).eq('id', req.staff_id)
      if (sErr) return NextResponse.json({ error: `staff更新失敗: ${sErr.message}` }, { status: 500 })
    }

    // 緊急連絡先: 既存のis_currentをfalseにしてから新規行追加
    if (Object.keys(emergencyUpdate).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('staff_emergency_contacts')
        .update({ is_current: false, effective_to: new Date().toISOString() })
        .eq('staff_id', req.staff_id)
        .eq('is_current', true)

      // staffテーブルにも最新をミラー
      const currentStaffUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if ('emergency_contact_name' in emergencyUpdate) {
        currentStaffUpdate.emergency_contact_name = emergencyUpdate.emergency_contact_name
      }
      if ('emergency_contact_phone' in emergencyUpdate) {
        currentStaffUpdate.emergency_contact_phone = emergencyUpdate.emergency_contact_phone
      }
      await admin.from('staff').update(currentStaffUpdate).eq('id', req.staff_id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('staff_emergency_contacts').insert({
        staff_id: req.staff_id,
        contact_name: emergencyUpdate.emergency_contact_name || null,
        contact_phone: emergencyUpdate.emergency_contact_phone || null,
        contact_relation: emergencyUpdate.emergency_contact_relation || null,
        is_current: true,
      })
    }

    // 申請をAPPROVEDに
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('profile_change_requests')
      .update({
        status: 'APPROVED',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('POST approve error:', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
