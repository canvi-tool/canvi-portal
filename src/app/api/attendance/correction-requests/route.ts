import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'
import { getProjectAccess } from '@/lib/auth/project-access'
import { sendProjectNotification, type SlackBlock } from '@/lib/integrations/slack'

const createSchema = z.object({
  attendance_record_id: z.string().uuid(),
  requested_clock_in: z.string().datetime().nullable().optional(),
  requested_clock_out: z.string().datetime().nullable().optional(),
  requested_break_minutes: z.number().int().min(0).nullable().optional(),
  requested_note: z.string().nullable().optional(),
  reason: z.string().min(1, '修正理由は必須です'),
})

// GET: 修正申請一覧
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope') || 'self' // 'self' | 'manage'
    const status = searchParams.get('status')

    let query = supabase
      .from('attendance_correction_requests')
      .select(
        '*, attendance_record:attendance_record_id(id, date, clock_in, clock_out, break_minutes, status), requester:requested_by_user_id(id, display_name, email), reviewer:reviewed_by_user_id(id, display_name), project:project_id(id, name, project_code)'
      )
      .order('created_at', { ascending: false })

    if (scope === 'manage') {
      if (!isOwner(user) && !isAdmin(user)) {
        return NextResponse.json({ error: '管理権限が必要です' }, { status: 403 })
      }
      const { allowedProjectIds } = await getProjectAccess()
      if (allowedProjectIds !== null) {
        if (allowedProjectIds.length === 0) return NextResponse.json({ data: [] })
        query = query.in('project_id', allowedProjectIds)
      }
      query = query.neq('requested_by_user_id', user.id)
    } else {
      query = query.eq('requested_by_user_id', user.id)
    }

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) {
      console.error('GET correction-requests error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('GET correction-requests error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

// POST: 修正申請作成
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    // 元レコード取得（自分のレコードのみ申請可）
    const { data: rec, error: recErr } = await supabase
      .from('attendance_records')
      .select('*, project:project_id(id, name, project_code, slack_channel_id)')
      .eq('id', parsed.data.attendance_record_id)
      .is('deleted_at', null)
      .single()

    if (recErr || !rec) {
      return NextResponse.json({ error: '対象の打刻レコードが見つかりません' }, { status: 404 })
    }
    if (rec.user_id !== user.id) {
      return NextResponse.json({ error: '自分の打刻のみ申請できます' }, { status: 403 })
    }

    const { data: created, error: insErr } = await supabase
      .from('attendance_correction_requests')
      .insert({
        attendance_record_id: rec.id,
        requested_by_user_id: user.id,
        project_id: rec.project_id,
        original_clock_in: rec.clock_in,
        original_clock_out: rec.clock_out,
        original_break_minutes: rec.break_minutes,
        original_note: rec.note,
        requested_clock_in: parsed.data.requested_clock_in ?? rec.clock_in,
        requested_clock_out: parsed.data.requested_clock_out ?? rec.clock_out,
        requested_break_minutes: parsed.data.requested_break_minutes ?? rec.break_minutes,
        requested_note: parsed.data.requested_note ?? rec.note,
        reason: parsed.data.reason,
        status: 'pending',
      })
      .select()
      .single()

    if (insErr) {
      console.error('POST correction-requests insert error:', insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    // Slack通知（PJチャンネルへ）
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const proj = rec.project as any
      const staffName = user.displayName || user.email || 'メンバー'
      const fmt = (s: string | null) =>
        s
          ? new Date(s).toLocaleString('ja-JP', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Tokyo',
            })
          : '-'
      const text = `${proj?.name ? `${proj.name}｜` : ''}${staffName}の打刻修正が申請されました`
      const blockText = `:memo: 打刻修正申請\n*${staffName}* さんから打刻修正の申請があります${proj?.name ? `（${proj.name}）` : ''}\n• 出勤: ${fmt(rec.clock_in)} → ${fmt(parsed.data.requested_clock_in ?? rec.clock_in)}\n• 退勤: ${fmt(rec.clock_out)} → ${fmt(parsed.data.requested_clock_out ?? rec.clock_out)}\n• 休憩: ${rec.break_minutes ?? 0}分 → ${parsed.data.requested_break_minutes ?? rec.break_minutes ?? 0}分\n• 理由: ${parsed.data.reason}`
      const blocks: SlackBlock[] = [
        { type: 'section', text: { type: 'mrkdwn', text: blockText } },
        {
          type: 'actions',
          block_id: 'correction_actions',
          elements: [
            {
              type: 'button',
              style: 'primary',
              text: { type: 'plain_text', text: '承認' },
              action_id: 'correction_approve',
              value: created.id,
            },
            {
              type: 'button',
              style: 'danger',
              text: { type: 'plain_text', text: '差戻し' },
              action_id: 'correction_reject',
              value: created.id,
            },
          ],
        },
      ]
      const result = await sendProjectNotification(
        { text, blocks },
        proj?.slack_channel_id || null,
        { projectId: rec.project_id, staffId: rec.staff_id }
      )
      if (result.ts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const adminSupabase = createAdminClient() as any
        await adminSupabase
          .from('attendance_correction_requests')
          .update({ slack_thread_ts: result.ts })
          .eq('id', created.id)
      }
    } catch (err) {
      console.error('correction-request slack notify error:', err)
    }

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('POST correction-requests error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
