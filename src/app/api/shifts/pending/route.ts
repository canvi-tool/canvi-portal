import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// デモ用承認待ちシフトデータ
const DEMO_PENDING_SHIFTS = [
  {
    id: 'shift-002',
    staff_id: 'staff-002',
    project_id: 'proj-001',
    shift_date: '2026-03-28',
    start_time: '10:00',
    end_time: '19:00',
    status: 'SUBMITTED',
    notes: '午前中はリモート作業',
    submitted_at: '2026-03-26T09:00:00Z',
    created_by: 'user-003',
    created_at: '2026-03-25T14:00:00Z',
    updated_at: '2026-03-26T09:00:00Z',
    staff_name: '佐藤 花子',
    project_name: 'Webサイトリニューアル',
    project_shift_approval_mode: 'APPROVAL',
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
    submitted_at: '2026-03-28T07:00:00Z',
    created_by: 'user-004',
    created_at: '2026-03-27T16:00:00Z',
    updated_at: '2026-03-28T07:00:00Z',
    staff_name: '鈴木 一郎',
    project_name: 'Webサイトリニューアル',
    project_shift_approval_mode: 'APPROVAL',
  },
  {
    id: 'shift-008',
    staff_id: 'staff-004',
    project_id: 'proj-003',
    shift_date: '2026-04-01',
    start_time: '13:00',
    end_time: '22:00',
    status: 'SUBMITTED',
    notes: '夜間対応シフト',
    submitted_at: '2026-03-27T10:00:00Z',
    created_by: 'user-005',
    created_at: '2026-03-26T15:00:00Z',
    updated_at: '2026-03-27T10:00:00Z',
    staff_name: '高橋 美咲',
    project_name: 'ECサイト運用保守',
    project_shift_approval_mode: 'APPROVAL',
  },
  {
    id: 'shift-009',
    staff_id: 'staff-001',
    project_id: 'proj-002',
    shift_date: '2026-04-02',
    start_time: '09:30',
    end_time: '18:30',
    status: 'SUBMITTED',
    notes: 'クライアント打ち合わせあり',
    submitted_at: '2026-03-28T08:00:00Z',
    created_by: 'user-002',
    created_at: '2026-03-27T17:00:00Z',
    updated_at: '2026-03-28T08:00:00Z',
    staff_name: '田中 太郎',
    project_name: 'モバイルアプリ開発',
    project_shift_approval_mode: 'APPROVAL',
  },
]

// GET /api/shifts/pending - 承認待ちシフト一覧 (PM/admin用)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    if (DEMO_MODE) {
      let data = DEMO_PENDING_SHIFTS
      if (projectId) {
        data = data.filter((s) => s.project_id === projectId)
      }
      return NextResponse.json({ data, total: data.length })
    }

    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('shifts')
      .select('*, staff:staff_id(id, full_name), project:project_id(id, name, shift_approval_mode)', { count: 'exact' })
      .eq('status', 'SUBMITTED')
      .is('deleted_at', null)
      .order('submitted_at', { ascending: true })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = (data || []).map((shift) => ({
      ...shift,
      staff_name: (shift.staff as { full_name?: string } | null)?.full_name || '',
      project_name: (shift.project as { name?: string } | null)?.name || '',
      project_shift_approval_mode: (shift.project as { shift_approval_mode?: string } | null)?.shift_approval_mode || 'AUTO',
    }))

    return NextResponse.json({ data: result, total: count || 0 })
  } catch (error) {
    console.error('GET /api/shifts/pending error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
