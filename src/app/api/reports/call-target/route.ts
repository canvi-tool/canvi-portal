export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/rbac'

const CALLS_PER_HOUR = 25
const BREAK_THRESHOLD_HOURS = 5
const BREAK_DURATION_HOURS = 1

/**
 * GET /api/reports/call-target?date=2026-04-12&project_id=xxx
 *
 * シフトの合計稼働時間から架電数目標を自動計算:
 * - 1時間あたり25件
 * - 5時間超のシフトは1時間休憩を減算
 * - 端数は切り上げ
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

    // そのユーザーの、その日・そのPJのシフトを取得（WORK系のみ、承認済み or 提出済み）
    const { data: shifts, error } = await supabase
      .from('shifts')
      .select('start_time, end_time, shift_type')
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

    if (workShifts.length === 0) {
      return NextResponse.json({
        callTarget: 0,
        shiftHours: 0,
        effectiveHours: 0,
        shifts: 0,
        message: 'この日のシフトが登録されていません',
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

    // 5時間超は1時間休憩を減算
    const effectiveHours =
      totalHours > BREAK_THRESHOLD_HOURS
        ? totalHours - BREAK_DURATION_HOURS
        : totalHours

    // 架電数目標 = 有効時間 × 25件/h（切り上げ）
    const callTarget = Math.ceil(effectiveHours * CALLS_PER_HOUR)

    return NextResponse.json({
      callTarget,
      shiftHours: Math.round(totalHours * 10) / 10,
      effectiveHours: Math.round(effectiveHours * 10) / 10,
      shifts: workShifts.length,
    })
  } catch (error) {
    console.error('Call target calculation error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
