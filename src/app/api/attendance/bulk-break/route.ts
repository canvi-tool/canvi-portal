import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'
import {
  sendProjectNotification,
  buildBreakStartNotification,
  buildBreakEndNotification,
  isNotificationEnabled,
} from '@/lib/integrations/slack'
import { extractSlackThreadTs } from '@/lib/utils/slack-thread'

// 複数PJ並行勤務時の一括休憩開始/終了
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const action = body.action as 'break_start' | 'break_end'
    if (action !== 'break_start' && action !== 'break_end') {
      return NextResponse.json({ error: '不正なactionです' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    const targetStatus = action === 'break_start' ? 'clocked_in' : 'on_break'

    const { data: records, error: fetchError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('status', targetStatus)
      .is('deleted_at', null)

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!records || records.length === 0) {
      return NextResponse.json(
        { error: action === 'break_start' ? '勤務中のレコードがありません' : '休憩中のレコードがありません' },
        { status: 409 }
      )
    }

    const staffName = user.displayName || user.email || 'メンバー'
    const results = []

    for (const record of records) {
      let updated = null
      let additionalMinutes = 0

      if (action === 'break_start') {
        const { data, error } = await supabase
          .from('attendance_records')
          .update({ break_start: now, status: 'on_break' })
          .eq('id', record.id)
          .select()
          .single()
        if (!error && data) {
          updated = data
          results.push(data)
        }
      } else {
        const breakStart = new Date(record.break_start!)
        const breakEnd = new Date(now)
        additionalMinutes = Math.round((breakEnd.getTime() - breakStart.getTime()) / 60000)
        const total = (record.break_minutes || 0) + additionalMinutes
        const { data, error } = await supabase
          .from('attendance_records')
          .update({ break_end: now, break_minutes: total, status: 'clocked_in' })
          .eq('id', record.id)
          .select()
          .single()
        if (!error && data) {
          updated = data
          results.push(data)
        }
      }

      if (!updated) continue

      // Slack通知（PJスレッドへ）
      try {
        let channelId: string | null = null
        if (record.project_id) {
          const { data: proj } = await supabase
            .from('projects')
            .select('slack_channel_id')
            .eq('id', record.project_id)
            .single()
          channelId = proj?.slack_channel_id || null
        }
        const threadTs = extractSlackThreadTs(record.note)
        const toggleKey = action === 'break_start' ? 'attendance_break_start' : 'attendance_break_end'
        if (await isNotificationEnabled(record.project_id, toggleKey)) {
          const notification = action === 'break_start'
            ? buildBreakStartNotification(staffName)
            : buildBreakEndNotification(staffName, additionalMinutes)
          await sendProjectNotification(notification, channelId, {
            ...(threadTs ? { thread_ts: threadTs } : {}),
            projectId: record.project_id,
            staffId: record.staff_id,
          })
        }
      } catch (err) {
        console.error('[bulk-break] Slack通知エラー:', err)
      }
    }

    return NextResponse.json({ count: results.length, records: results })
  } catch (error) {
    console.error('POST /api/attendance/bulk-break error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
