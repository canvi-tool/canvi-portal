export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'

const CALLS_PER_HOUR = 25

/**
 * GET /api/reports/call-target?date=2026-04-12&project_id=xxx
 *
 * シフト時間から架電数目標を自動計算 + シフト情報を返却
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.staffId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const projectId = searchParams.get('project_id')

    if (!date || !projectId) {
      return NextResponse.json(
        { error: 'date と project_id パラメータが必要です' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // プロジェクト情報を取得（BPO判定用）
    const { data: project } = await supabase
      .from('projects')
      .select('id, name, project_type')
      .eq('id', projectId)
      .maybeSingle()

    const isBpo = project?.project_type === 'BPO'

    // そのユーザーの、その日・そのPJのシフトを取得
    const { data: shifts, error } = await supabase
      .from('shifts')
      .select('id, start_time, end_time, shift_type, status')
      .eq('staff_id', user.staffId)
      .eq('project_id', projectId)
      .eq('shift_date', date)
      .in('status', ['APPROVED', 'SUBMITTED'] as const)
      .is('deleted_at', null)

    if (error) {
      console.error('Shift query error:', error)
      return NextResponse.json({ error: 'シフトデータの取得に失敗しました' }, { status: 500 })
    }

    // WORKタイプのシフトのみ対象
    const workShifts = (shifts ?? []).filter(
      (s) => !s.shift_type || s.shift_type === 'WORK'
    )

    // シフト詳細（UI表示用）
    const shiftDetails = workShifts.map((s) => ({
      id: s.id,
      startTime: s.start_time,
      endTime: s.end_time,
      status: s.status,
    }))

    if (workShifts.length === 0) {
      return NextResponse.json({
        shiftHours: 0,
        shiftMinutes: 0,
        callsPerHour: CALLS_PER_HOUR,
        shifts: 0,
        shiftDetails: [],
        isBpo,
        projectName: project?.name ?? '',
        projectType: project?.project_type ?? '',
        hasShift: false,
        staffId: user.staffId,
      })
    }

    // 各シフトの時間を合算
    let totalMinutes = 0
    for (const shift of workShifts) {
      if (!shift.start_time || !shift.end_time) continue
      const startParts = shift.start_time.split(':').map(Number)
      const endParts = shift.end_time.split(':').map(Number)
      const startMin = startParts[0] * 60 + (startParts[1] || 0)
      const endMin = endParts[0] * 60 + (endParts[1] || 0)
      if (endMin > startMin) {
        totalMinutes += endMin - startMin
      }
    }

    const totalHours = totalMinutes / 60
    const roundedTotal = Math.round(totalHours * 10) / 10
    // 休憩はクライアント側で入力・計算するため、ここではシフト合計のみ返す
    return NextResponse.json({
      shiftHours: roundedTotal,
      shiftMinutes: totalMinutes,
      callsPerHour: CALLS_PER_HOUR,
      shifts: workShifts.length,
      shiftDetails,
      isBpo,
      projectName: project?.name ?? '',
      projectType: project?.project_type ?? '',
      hasShift: true,
      staffId: user.staffId,
    })
  } catch (error) {
    console.error('Call target calculation error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
