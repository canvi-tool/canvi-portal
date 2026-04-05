import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { shiftFormSchema, shiftDragUpdateSchema, shiftInlineUpdateSchema } from '@/lib/validations/shift'
import { syncShiftToCalendar, deleteShiftFromCalendar } from '@/lib/integrations/google-calendar-sync'
import { getCurrentUser, isManagerOrOwner } from '@/lib/auth/rbac'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('shifts')
      .select('*, staff:staff_id(id, last_name, first_name), project:project_id(id, name)')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 承認履歴を取得
    const { data: history } = await supabase
      .from('shift_approval_history')
      .select('*, performer:performed_by(id, email)')
      .eq('shift_id', id)
      .order('performed_at', { ascending: true })

    return NextResponse.json({
      ...data,
      staff_name: (() => { const s = data.staff as { last_name?: string; first_name?: string } | null; return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : '' })(),
      project_name: (data.project as { name?: string } | null)?.name || '',
      approval_history: history || [],
    })
  } catch (error) {
    console.error('GET /api/shifts/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const body = await request.json()
    const isDragUpdate = body._dragUpdate === true
    const isInlineUpdate = body._inlineUpdate === true

    // バリデーション: ドラッグ / インライン編集 / 通常の全体更新
    if (isDragUpdate) {
      const parsed = shiftDragUpdateSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'バリデーションエラー', details: parsed.error.flatten() },
          { status: 400 }
        )
      }
    } else if (isInlineUpdate) {
      const parsed = shiftInlineUpdateSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'バリデーションエラー', details: parsed.error.flatten() },
          { status: 400 }
        )
      }
    } else {
      const parsed = shiftFormSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'バリデーションエラー', details: parsed.error.flatten() },
          { status: 400 }
        )
      }
    }

    const supabase = await createServerSupabaseClient()

    // ステータスチェック
    const { data: existing } = await supabase
      .from('shifts')
      .select('status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
    }

    // APPROVED済みシフトは管理者/オーナーのみ編集可能
    if (existing.status === 'APPROVED') {
      const currentUser = await getCurrentUser()
      if (!currentUser || !isManagerOrOwner(currentUser)) {
        return NextResponse.json(
          { error: '承認済みのシフトは管理者のみ編集できます。' },
          { status: 403 }
        )
      }
    }

    // 更新データ構築
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (isDragUpdate) {
      // ドラッグ操作: 日時のみ更新
      updateData.shift_date = body.shift_date
      updateData.start_time = body.start_time
      updateData.end_time = body.end_time
    } else if (isInlineUpdate) {
      // インライン編集: 時間 + オプショナルなプロジェクト・備考
      updateData.start_time = body.start_time
      updateData.end_time = body.end_time
      if (body.project_id) updateData.project_id = body.project_id
      if (body.notes !== undefined) updateData.notes = body.notes || null
    } else {
      // 通常更新: 全フィールド
      updateData.staff_id = body.staff_id
      updateData.project_id = body.project_id
      updateData.shift_date = body.shift_date
      updateData.start_time = body.start_time
      updateData.end_time = body.end_time
      updateData.shift_type = body.shift_type || 'WORK'
      updateData.notes = body.notes || null
    }

    const { data, error } = await supabase
      .from('shifts')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // APPROVED状態のシフトが変更された場合、Googleカレンダーも同期
    if (data?.status === 'APPROVED' && data?.id) {
      syncShiftToCalendar(data.id).catch((e) =>
        console.error('Calendar sync failed:', e)
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PUT /api/shifts/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    // 認証チェック
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()

    // Googleカレンダーからイベント削除（fire-and-forget）
    deleteShiftFromCalendar(id).catch((e) =>
      console.error('Calendar delete failed:', e)
    )

    // 論理削除
    const { error } = await supabase
      .from('shifts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/shifts/[id] error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
