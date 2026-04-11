import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isOwner, isAdmin } from '@/lib/auth/rbac'
import { canManageProjectShifts } from '@/lib/auth/project-access'
import { sendProjectNotification } from '@/lib/integrations/slack'

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().optional(),
})

// PATCH: 承認 / 差戻し
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!isOwner(user) && !isAdmin(user)) {
      return NextResponse.json({ error: '管理権限が必要です' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'バリデーションエラー' }, { status: 400 })
    }
    if (parsed.data.action === 'reject' && !parsed.data.comment?.trim()) {
      return NextResponse.json({ error: '差戻しにはコメントが必要です' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerSupabaseClient()) as any
    const { data: req, error: reqErr } = await supabase
      .from('attendance_correction_requests')
      .select('*, attendance_record:attendance_record_id(*), project:project_id(id, name, slack_channel_id), requester:requested_by_user_id(id, display_name, email)')
      .eq('id', id)
      .single()

    if (reqErr || !req) {
      return NextResponse.json({ error: '申請が見つかりません' }, { status: 404 })
    }
    if (req.status !== 'pending') {
      return NextResponse.json({ error: '既に処理済みです' }, { status: 409 })
    }
    // PJ管理権限チェック
    if (req.project_id) {
      const { canManage } = await canManageProjectShifts(req.project_id)
      if (!canManage) {
        return NextResponse.json({ error: 'このPJの管理権限がありません' }, { status: 403 })
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminSupabase = createAdminClient() as any
    const newStatus = parsed.data.action === 'approve' ? 'approved' : 'rejected'

    // 承認の場合: 元レコードに変更を適用
    if (parsed.data.action === 'approve' && req.attendance_record_id) {
      const update: Record<string, unknown> = {
        clock_in: req.requested_clock_in,
        clock_out: req.requested_clock_out,
        break_minutes: req.requested_break_minutes,
        note: req.requested_note,
        status: 'modified',
        modified_by: user.id,
        modification_reason: req.reason,
      }
      // work_minutes 再計算
      if (req.requested_clock_in && req.requested_clock_out) {
        const ms =
          new Date(req.requested_clock_out).getTime() -
          new Date(req.requested_clock_in).getTime()
        const total = Math.max(0, Math.floor(ms / 60000) - (req.requested_break_minutes || 0))
        update.work_minutes = total
      }
      const { error: applyErr } = await adminSupabase
        .from('attendance_records')
        .update(update)
        .eq('id', req.attendance_record_id)
      if (applyErr) {
        console.error('apply correction error:', applyErr)
        return NextResponse.json({ error: applyErr.message }, { status: 500 })
      }
    }

    const { data: updated, error: updErr } = await adminSupabase
      .from('attendance_correction_requests')
      .update({
        status: newStatus,
        reviewed_by_user_id: user.id,
        reviewed_at: new Date().toISOString(),
        review_comment: parsed.data.comment || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    // Slack通知（スレッド返信）
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const proj = req.project as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requester = req.requester as any
      const reviewerName = user.displayName || user.email || '管理者'
      const requesterName = requester?.display_name || requester?.email || 'メンバー'
      const projectName = proj?.name || ''
      const text =
        parsed.data.action === 'approve'
          ? `:white_check_mark: ${projectName ? `${projectName}｜` : ''}*${requesterName}* の打刻修正が承認されました\n👤 承認者: *${reviewerName}*`
          : `:no_entry: ${projectName ? `${projectName}｜` : ''}*${requesterName}* の打刻修正が差戻されました\n👤 差戻し者: *${reviewerName}*\n理由: ${parsed.data.comment}`
      await sendProjectNotification(
        { text, blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }] },
        proj?.slack_channel_id || null,
        { projectId: req.project_id, thread_ts: req.slack_thread_ts || undefined }
      )
    } catch (err) {
      console.error('correction review slack notify error:', err)
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH correction-requests error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
