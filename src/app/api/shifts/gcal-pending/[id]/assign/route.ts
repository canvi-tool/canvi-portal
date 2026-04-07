/**
 * POST /api/shifts/gcal-pending/[id]/assign
 * PJ未割当のGCalイベントを shifts に昇格
 * Body: { project_id: string, shift_type?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProjectAccess } from '@/lib/auth/project-access'
import { isOwner, isAdmin } from '@/lib/auth/rbac'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const projectId = body.project_id as string | undefined
    const shiftType = (body.shift_type as string | undefined) || 'WORK'
    if (!projectId) {
      return NextResponse.json({ error: 'project_id は必須です' }, { status: 400 })
    }

    const admin = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pending, error: pErr } = await (admin as any).from('gcal_pending_events')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (pErr || !pending) {
      return NextResponse.json({ error: '該当イベントが見つかりません' }, { status: 404 })
    }

    // 権限チェック: メンバーは PJ 割当不可。オーナー or 管理者(自PJに対して) のみ可
    const access = await getProjectAccess()
    const currentUser = access.user
    if (!currentUser || (!isOwner(currentUser) && !isAdmin(currentUser))) {
      return NextResponse.json({ error: 'PJ割り当ては管理者のみ実行できます' }, { status: 403 })
    }
    const isSelfEvent = !!access.staffId && pending.staff_id === access.staffId
    const ownerOk = !!currentUser && isOwner(currentUser)
    const adminPjOk =
      !!currentUser &&
      isAdmin(currentUser) &&
      (access.allowedProjectIds === null || access.allowedProjectIds.includes(projectId))
    // 管理者は対象スタッフが自PJにアサインされているかも検証
    let adminStaffOk = false
    if (adminPjOk && access.allowedProjectIds !== null && pending.staff_id) {
      const { data: assigns } = await admin
        .from('project_assignments')
        .select('project_id')
        .eq('staff_id', pending.staff_id)
        .in('project_id', access.allowedProjectIds)
        .is('deleted_at', null)
        .limit(1)
      adminStaffOk = !!(assigns && assigns.length > 0)
    } else if (adminPjOk && access.allowedProjectIds === null) {
      adminStaffOk = true
    }
    if (!isSelfEvent && !ownerOk && !(adminPjOk && adminStaffOk)) {
      return NextResponse.json({ error: '他人のGoogleカレンダー予定にPJを割り当てる権限がありません' }, { status: 403 })
    }

    // shifts へINSERT (source=google_calendar, 紐付け情報を引き継ぐ)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertPayload: any = {
      created_by: user.id,
      staff_id: pending.staff_id,
      project_id: projectId,
      shift_date: pending.event_date,
      start_time: pending.start_time,
      end_time: pending.end_time,
      shift_type: shiftType,
      status: 'APPROVED',
      notes: pending.title || null,
      source: 'google_calendar',
      external_event_id: pending.external_event_id,
      external_calendar_id: pending.external_calendar_id,
      external_updated_at: pending.external_updated_at,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error: iErr } = await (admin.from('shifts') as any)
      .insert(insertPayload)
      .select()
      .single()
    if (iErr) {
      return NextResponse.json({ error: `INSERT失敗: ${iErr.message}` }, { status: 500 })
    }

    // pending レコード削除
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('gcal_pending_events').delete().eq('id', id)

    return NextResponse.json({ shift: inserted })
  } catch (error) {
    console.error('POST /api/shifts/gcal-pending/[id]/assign error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
