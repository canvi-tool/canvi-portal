import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getProjectAccess } from '@/lib/auth/project-access'
import { syncShiftToCalendar } from '@/lib/integrations/google-calendar-sync'
import { z } from 'zod'

const bulkShiftSchema = z.object({
  staff_id: z.string().min(1),
  project_id: z.string().min(1),
  shift_type: z.enum(['WORK', 'ABSENCE']).default('WORK'),
  notes: z.string().optional(),
  entries: z.array(z.object({
    shift_date: z.string().min(1),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
  })).min(1, '少なくとも1件のシフトを指定してください'),
})

export async function POST(request: NextRequest) {
  try {
    const { user } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = bulkShiftSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: parsed.error.flatten() },
        { status: 400 }
      )
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

    const rows = parsed.data.entries.map((entry) => {
      const base: Record<string, unknown> = {
        staff_id: parsed.data.staff_id,
        project_id: parsed.data.project_id,
        shift_date: entry.shift_date,
        start_time: entry.start_time,
        end_time: entry.end_time,
        shift_type: parsed.data.shift_type,
        notes: parsed.data.notes || null,
        created_by: user.id,
      }

      if (isAutoApproval) {
        base.status = 'APPROVED'
        base.submitted_at = now
        base.approved_at = now
        base.approved_by = user.id
      } else {
        base.status = 'SUBMITTED'
        base.submitted_at = now
      }

      return base
    })

    const { data, error } = await supabase
      .from('shifts')
      .insert(rows as never[])
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // AUTO承認時はGoogleカレンダー同期
    if (isAutoApproval && data) {
      for (const shift of data) {
        syncShiftToCalendar(shift.id).catch((e) =>
          console.error('Calendar sync failed:', e)
        )
      }
    }

    return NextResponse.json({
      created: data?.length || 0,
      data,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/shifts/bulk error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
