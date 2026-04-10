import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { shiftFormSchema } from '@/lib/validations/shift'
import { getProjectAccess, canEditShift } from '@/lib/auth/project-access'
import { syncShiftToCalendar } from '@/lib/integrations/google-calendar-sync'
import { sendProjectNotificationIfEnabled } from '@/lib/integrations/slack'

const SHIFT_TYPE_LABELS: Record<string, string> = {
  WORK: '通常勤務',
  PAID_LEAVE: '有給休暇',
  ABSENCE: '欠勤',
  HALF_DAY_LEAVE: '半休',
  SPECIAL_LEAVE: '特別休暇',
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const staffId = searchParams.get('staff_id') // supports comma-separated IDs
    const projectId = searchParams.get('project_id')
    const status = searchParams.get('status')

    const __t0 = Date.now()
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
      // 必要最小限のカラムのみ取得（レスポンスサイズ削減）
      .select(
        'id, staff_id, project_id, shift_date, start_time, end_time, status, shift_type, title, notes, attendees, google_meet_url, google_calendar_event_id, external_event_id, source, needs_project_assignment, slack_thread_ts, submitted_at, approved_at, created_at, staff:staff_id(id, last_name, first_name), project:project_id(id, name, shift_approval_mode)'
      )
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
      // FullCalendarのdatesSetはendを排他的に返す（週表示4/6-12→end=4/13）ため lt を使用
      query = query.lt('shift_date', endDate)
    }
    if (staffId) {
      // 'staff_ids' (新) または 'staff_id' (旧/互換) いずれもカンマ区切りを許容
      const rawIds = (searchParams.get('staff_ids') || staffId)
      const staffIds = rawIds.split(',').map((s) => s.trim()).filter(Boolean)
      if (staffIds.length > 0) {
        // staff_id 本人のシフト OR attendees に staff_id を含むシフト（招待されたシフト）
        // NOTE: PostgREST の or() 内で `in.(a,b)` を使うとカンマが or の区切りとして
        // 解釈されてしまうため、必ず `staff_id.eq.X` を id 毎に並べる。
        const parts: string[] = []
        for (const id of staffIds) {
          parts.push(`staff_id.eq.${id}`)
        }
        for (const id of staffIds) {
          parts.push(`attendees.cs.[{"staff_id":"${id}"}]`)
        }
        query = query.or(parts.join(','))
      }
    } else {
      const idsParam = searchParams.get('staff_ids')
      if (idsParam) {
        const staffIds = idsParam.split(',').map((s) => s.trim()).filter(Boolean)
        if (staffIds.length > 0) {
          const parts: string[] = []
          for (const id of staffIds) parts.push(`staff_id.eq.${id}`)
          for (const id of staffIds) parts.push(`attendees.cs.[{"staff_id":"${id}"}]`)
          query = query.or(parts.join(','))
        }
      }
    }
    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    if (status) {
      query = query.eq('status', status as 'SUBMITTED' | 'APPROVED' | 'NEEDS_REVISION')
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = ((data || []) as unknown as Array<Record<string, unknown>>).map((shift) => ({
      ...shift,
      staff_name: (() => { const s = shift.staff as { last_name?: string; first_name?: string } | null; return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : '' })(),
      project_name: (shift.project as { name?: string } | null)?.name || '',
    }))

    const __ms = Date.now() - __t0
    if (__ms > 300) {
      console.log(`[shifts.GET] ${__ms}ms rows=${result.length} range=${startDate}~${endDate} staff=${staffId || ''}`)
    }
    return NextResponse.json({ data: result, total: result.length })
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

    const { user, staffId, allowedProjectIds } = await getProjectAccess()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    // プロジェクトアクセス権チェック
    if (allowedProjectIds !== null && !allowedProjectIds.includes(parsed.data.project_id)) {
      return NextResponse.json({ error: 'このプロジェクトへのアクセス権がありません' }, { status: 403 })
    }

    // 作成対象シフトの編集権限チェック（メンバーは自分以外のシフトを作成できない）
    const { canEdit } = await canEditShift({
      staff_id: parsed.data.staff_id,
      project_id: parsed.data.project_id,
    })
    if (!canEdit) {
      return NextResponse.json(
        { error: '他のスタッフのシフトを作成する権限がありません' },
        { status: 403 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // プロジェクトの承認モードとSlackチャンネルを確認
    const { data: project } = await supabase
      .from('projects')
      .select('shift_approval_mode, slack_channel_id, name')
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
      shift_type: parsed.data.shift_type || 'WORK',
      title: parsed.data.title || null,
      notes: parsed.data.notes || null,
      attendees: parsed.data.attendees || [],
      created_by: user.id,
    }

    // AUTO モードの場合は即時承認、それ以外は申請中として作成
    if (isAutoApproval) {
      insertData.status = 'APPROVED'
      insertData.submitted_at = now
      insertData.approved_at = now
      insertData.approved_by = user.id
    } else {
      insertData.status = 'SUBMITTED'
      insertData.submitted_at = now
    }

    const { data, error } = await supabase
      .from('shifts')
      .insert(insertData as never)
      .select('*, staff:staff_id(id, last_name, first_name)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // シフト作成時は常にGoogleカレンダーへ同期（SUBMITTED でも APPROVED でも）
    if (data?.id) {
      try {
        await syncShiftToCalendar(data.id)
      } catch (e) {
        console.error('Calendar sync failed on create:', e)
      }
    }

    // AUTO承認時はSlack通知も送信
    if (isAutoApproval && data?.id) {
      // AUTO承認時のSlack通知（登録完了通知）
      if (project?.slack_channel_id) {
        const staffName = (() => {
          const s = data.staff as { last_name?: string; first_name?: string } | null
          return s ? `${s.last_name || ''} ${s.first_name || ''}`.trim() : ''
        })()
        const shiftTypeLabel = SHIFT_TYPE_LABELS[parsed.data.shift_type || 'WORK'] || 'シフト'

        const result = await sendProjectNotificationIfEnabled(
          {
            text: `📅 ${staffName} のシフトが登録されました（${project.name || ''}）`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `📅 *${staffName}* のシフトが自動確定されました\n📆 ${parsed.data.shift_date} | ⏰ ${parsed.data.start_time}〜${parsed.data.end_time} | 🏢 ${project.name || ''}\n📝 種別: ${shiftTypeLabel}`,
                },
              },
            ],
          },
          parsed.data.project_id,
          project.slack_channel_id,
          'shift_submitted',
          { staffId: staffId || parsed.data.staff_id }
        )

        // slack_thread_ts 保存
        if (result.ts) {
          await supabase
            .from('shifts')
            .update({ slack_thread_ts: result.ts })
            .eq('id', data.id)
        }
      }
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/shifts error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
