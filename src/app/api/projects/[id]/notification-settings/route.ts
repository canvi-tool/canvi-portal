import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// 通知設定のフィールド一覧
const NOTIFICATION_FIELDS = [
  'attendance_clock_in',
  'attendance_clock_out',
  'attendance_missing',
  'shift_submitted',
  'shift_approved',
  'shift_rejected',
  'report_submitted',
  'report_overdue',
  'contract_unsigned',
  'payment_anomaly',
  'overtime_warning',
  'leave_requested',
  'member_assigned',
  'member_removed',
  'general_alert',
] as const

// デフォルト設定（テーブルのDEFAULT値と一致）
const DEFAULT_SETTINGS: Record<string, boolean> = {
  attendance_clock_in: false,
  attendance_clock_out: false,
  attendance_missing: true,
  shift_submitted: false,
  shift_approved: false,
  shift_rejected: true,
  report_submitted: false,
  report_overdue: true,
  contract_unsigned: true,
  payment_anomaly: true,
  overtime_warning: true,
  leave_requested: true,
  member_assigned: true,
  member_removed: true,
  general_alert: true,
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const projectId = params.id

    const { data, error } = await supabase
      .from('project_notification_settings')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found (single row expected but 0 returned)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 設定が存在しない場合はデフォルト値を返す
    if (!data) {
      return NextResponse.json({
        project_id: projectId,
        ...DEFAULT_SETTINGS,
        _isDefault: true,
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET notification-settings error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const projectId = params.id
    const body = await request.json()

    // フィールドのバリデーション: boolean値のみ受け付ける
    const settingsUpdate: Record<string, boolean> = {}
    for (const field of NOTIFICATION_FIELDS) {
      if (field in body && typeof body[field] === 'boolean') {
        settingsUpdate[field] = body[field]
      }
    }

    // 既存の設定を確認
    const { data: existing } = await supabase
      .from('project_notification_settings')
      .select('id')
      .eq('project_id', projectId)
      .single()

    let result
    if (existing) {
      // 既存レコードを更新
      const { data, error } = await supabase
        .from('project_notification_settings')
        .update(settingsUpdate)
        .eq('project_id', projectId)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      result = data
    } else {
      // 新規作成
      const { data, error } = await supabase
        .from('project_notification_settings')
        .insert({
          project_id: projectId,
          ...DEFAULT_SETTINGS,
          ...settingsUpdate,
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      result = data
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('PUT notification-settings error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
