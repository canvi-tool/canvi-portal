import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { shiftFormSchema } from '@/lib/validations/shift'
import { getProjectAccess } from '@/lib/auth/project-access'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// デモ用シフトデータ
const DEMO_SHIFTS = [
  {
    id: 'shift-001',
    staff_id: 'staff-001',
    project_id: 'proj-001',
    shift_date: '2026-03-28',
    start_time: '09:00',
    end_time: '18:00',
    status: 'APPROVED',
    notes: null,
    google_calendar_event_id: 'gcal-ev-001',
    google_calendar_synced: true,
    submitted_at: '2026-03-25T10:00:00Z',
    approved_at: '2026-03-25T11:00:00Z',
    approved_by: 'user-001',
    created_by: 'user-002',
    created_at: '2026-03-24T09:00:00Z',
    updated_at: '2026-03-25T11:00:00Z',
    deleted_at: null,
    staff_name: '田中 太郎',
    project_name: 'Webサイトリニューアル',
  },
  {
    id: 'shift-002',
    staff_id: 'staff-002',
    project_id: 'proj-001',
    shift_date: '2026-03-28',
    start_time: '10:00',
    end_time: '19:00',
    status: 'SUBMITTED',
    notes: '午前中はリモート作業',
    google_calendar_event_id: null,
    google_calendar_synced: false,
    submitted_at: '2026-03-26T09:00:00Z',
    approved_at: null,
    approved_by: null,
    created_by: 'user-003',
    created_at: '2026-03-25T14:00:00Z',
    updated_at: '2026-03-26T09:00:00Z',
    deleted_at: null,
    staff_name: '佐藤 花子',
    project_name: 'Webサイトリニューアル',
  },
  {
    id: 'shift-003',
    staff_id: 'staff-003',
    project_id: 'proj-002',
    shift_date: '2026-03-29',
    start_time: '08:30',
    end_time: '17:30',
    status: 'DRAFT',
    notes: null,
    google_calendar_event_id: null,
    google_calendar_synced: false,
    submitted_at: null,
    approved_at: null,
    approved_by: null,
    created_by: 'user-004',
    created_at: '2026-03-27T08:00:00Z',
    updated_at: '2026-03-27T08:00:00Z',
    deleted_at: null,
    staff_name: '鈴木 一郎',
    project_name: 'モバイルアプリ開発',
  },
  {
    id: 'shift-004',
    staff_id: 'staff-001',
    project_id: 'proj-002',
    shift_date: '2026-03-29',
    start_time: '09:00',
    end_time: '18:00',
    status: 'REJECTED',
    notes: '時間帯の変更をお願いします',
    google_calendar_event_id: null,
    google_calendar_synced: false,
    submitted_at: '2026-03-26T10:00:00Z',
    approved_at: null,
    approved_by: null,
    created_by: 'user-002',
    created_at: '2026-03-25T16:00:00Z',
    updated_at: '2026-03-26T15:00:00Z',
    deleted_at: null,
    staff_name: '田中 太郎',
    project_name: 'モバイルアプリ開発',
  },
  {
    id: 'shift-005',
    staff_id: 'staff-002',
    project_id: 'proj-001',
    shift_date: '2026-03-30',
    start_time: '10:00',
    end_time: '17:00',
    status: 'NEEDS_REVISION',
    notes: '勤務時間を確認してください',
    google_calendar_event_id: null,
    google_calendar_synced: false,
    submitted_at: '2026-03-27T09:00:00Z',
    approved_at: null,
    approved_by: null,
    created_by: 'user-003',
    created_at: '2026-03-26T10:00:00Z',
    updated_at: '2026-03-27T14:00:00Z',
    deleted_at: null,
    staff_name: '佐藤 花子',
    project_name: 'Webサイトリニューアル',
  },
  {
    id: 'shift-006',
    staff_id: 'staff-004',
    project_id: 'proj-003',
    shift_date: '2026-03-28',
    start_time: '13:00',
    end_time: '22:00',
    status: 'APPROVED',
    notes: '夜間シフト',
    google_calendar_event_id: 'gcal-ev-002',
    google_calendar_synced: true,
    submitted_at: '2026-03-24T08:00:00Z',
    approved_at: '2026-03-24T09:30:00Z',
    approved_by: 'user-001',
    created_by: 'user-005',
    created_at: '2026-03-23T11:00:00Z',
    updated_at: '2026-03-24T09:30:00Z',
    deleted_at: null,
    staff_name: '高橋 美咲',
    project_name: 'ECサイト運用保守',
  },
  {
    id: 'shift-007',
    staff_id: 'staff-003',
    project_id: 'proj-001',
    shift_date: '2026-03-31',
    start_time: '09:00',
    end_time: '18:00',
    status: 'SUBMITTED',
    notes: null,
    google_calendar_event_id: null,
    google_calendar_synced: false,
    submitted_at: '2026-03-28T07:00:00Z',
    approved_at: null,
    approved_by: null,
    created_by: 'user-004',
    created_at: '2026-03-27T16:00:00Z',
    updated_at: '2026-03-28T07:00:00Z',
    deleted_at: null,
    staff_name: '鈴木 一郎',
    project_name: 'Webサイトリニューアル',
  },
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const staffId = searchParams.get('staff_id')
    const projectId = searchParams.get('project_id')
    const status = searchParams.get('status')

    if (DEMO_MODE) {
      let data = DEMO_SHIFTS.filter((s) => s.deleted_at === null)
      if (startDate) data = data.filter((s) => s.shift_date >= startDate)
      if (endDate) data = data.filter((s) => s.shift_date <= endDate)
      if (staffId) data = data.filter((s) => s.staff_id === staffId)
      if (projectId) data = data.filter((s) => s.project_id === projectId)
      if (status) data = data.filter((s) => s.status === status)
      return NextResponse.json({ data, total: data.length })
    }

    const { user, allowedProjectIds } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // アサインなし → 空配列を返す
    if (allowedProjectIds !== null && allowedProjectIds.length === 0) {
      return NextResponse.json({ data: [], total: 0 })
    }

    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('shifts')
      .select('*, staff:staff_id(id, last_name, first_name), project:project_id(id, name)', { count: 'exact' })
      .is('deleted_at', null)
      .order('shift_date', { ascending: false })
      .order('start_time', { ascending: true })

    // オーナー以外はアサイン済みプロジェクトのシフトのみ
    if (allowedProjectIds) {
      query = query.in('project_id', allowedProjectIds)
    }

    if (startDate) {
      query = query.gte('shift_date', startDate)
    }
    if (endDate) {
      query = query.lte('shift_date', endDate)
    }
    if (staffId) {
      query = query.eq('staff_id', staffId)
    }
    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    if (status) {
      query = query.eq('status', status as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION')
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = (data || []).map((shift) => ({
      ...shift,
      staff_name: (() => { const s = shift.staff as { last_name?: string; first_name?: string } | null; return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : '' })(),
      project_name: (shift.project as { name?: string } | null)?.name || '',
    }))

    return NextResponse.json({ data: result, total: count || 0 })
  } catch (error) {
    console.error('GET /api/shifts error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = shiftFormSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    if (DEMO_MODE) {
      const newShift = {
        id: `shift-${Date.now()}`,
        staff_id: parsed.data.staff_id,
        project_id: parsed.data.project_id,
        shift_date: parsed.data.shift_date,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        status: 'APPROVED', // デモモードではAUTO承認
        notes: parsed.data.notes || null,
        google_calendar_event_id: null,
        google_calendar_synced: false,
        submitted_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        approved_by: 'user-001',
        created_by: 'user-001',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      }
      return NextResponse.json(newShift, { status: 201 })
    }

    const supabase = await createServerSupabaseClient()

    // プロジェクトの承認モードを確認
    const { data: project } = await supabase
      .from('projects')
      .select('shift_approval_mode')
      .eq('id', parsed.data.project_id)
      .single()

    const isAutoApproval = project?.shift_approval_mode === 'AUTO'
    const now = new Date().toISOString()

    const insertData: Record<string, unknown> = {
      staff_id: parsed.data.staff_id,
      project_id: parsed.data.project_id,
      shift_date: parsed.data.shift_date,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      notes: parsed.data.notes || null,
      created_by: body.created_by || null,
    }

    // AUTO モードの場合は即時承認
    if (isAutoApproval) {
      insertData.status = 'APPROVED'
      insertData.submitted_at = now
      insertData.approved_at = now
      insertData.approved_by = body.created_by || null
    } else {
      insertData.status = 'DRAFT'
    }

    const { data, error } = await supabase
      .from('shifts')
      .insert(insertData as never)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/shifts error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
