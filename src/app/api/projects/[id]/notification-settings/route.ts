import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// トグル（boolean）フィールド
const BOOLEAN_FIELDS = [
  'attendance_clock_in',
  'attendance_break_start',
  'attendance_break_end',
  'attendance_clock_out',
  'attendance_missing',
  'shift_submitted',
  'shift_approved',
  'shift_rejected',
  'report_submitted',
  'report_overdue',
  'overtime_warning',
  'leave_requested',
  'member_assigned',
  'member_removed',
] as const

// 数値パラメータフィールド（min, max バリデーション付き）
const NUMERIC_FIELDS: Record<string, { min: number; max: number }> = {
  attendance_missing_delay_minutes: { min: 1, max: 120 },
  attendance_missing_repeat_interval_minutes: { min: 1, max: 120 },
  attendance_missing_max_repeats: { min: 0, max: 10 },
  shift_submission_deadline_day: { min: 1, max: 28 },
  shift_submission_alert_start_days_before: { min: 1, max: 14 },
  shift_submission_alert_repeat_interval_days: { min: 1, max: 7 },
  report_overdue_delay_minutes: { min: 1, max: 60 },
  report_overdue_delay_hours: { min: 1, max: 24 },
  report_overdue_repeat_interval_hours: { min: 1, max: 24 },
  report_overdue_max_repeats: { min: 0, max: 10 },
  overtime_warning_threshold_hours: { min: 4, max: 16 },
}

// デフォルト設定
const DEFAULT_SETTINGS: Record<string, boolean | number> = {
  // トグル
  attendance_clock_in: true,
  attendance_break_start: false,
  attendance_break_end: false,
  attendance_clock_out: true,
  attendance_missing: true,
  shift_submitted: false,
  shift_approved: false,
  shift_rejected: false,
  report_submitted: true,
  report_overdue: true,
  overtime_warning: false,
  leave_requested: false,
  member_assigned: true,
  member_removed: true,
  // タイミングパラメータ
  attendance_missing_delay_minutes: 5,
  attendance_missing_repeat_interval_minutes: 5,
  attendance_missing_max_repeats: 5,
  shift_submission_deadline_day: 25,
  shift_submission_alert_start_days_before: 5,
  shift_submission_alert_repeat_interval_days: 2,
  report_overdue_delay_minutes: 5,
  report_overdue_delay_hours: 2,
  report_overdue_repeat_interval_hours: 4,
  report_overdue_max_repeats: 2,
  overtime_warning_threshold_hours: 8.0,
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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settingsUpdate: Record<string, any> = {}

    // Boolean フィールドのバリデーション
    for (const field of BOOLEAN_FIELDS) {
      if (field in body && typeof body[field] === 'boolean') {
        settingsUpdate[field] = body[field]
      }
    }

    // 数値フィールドのバリデーション（範囲チェック付き）
    for (const [field, range] of Object.entries(NUMERIC_FIELDS)) {
      if (field in body && typeof body[field] === 'number') {
        const val = body[field]
        // 範囲内にクランプ
        settingsUpdate[field] = Math.min(Math.max(val, range.min), range.max)
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
