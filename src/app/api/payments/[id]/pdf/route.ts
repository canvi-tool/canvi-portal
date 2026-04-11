import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { COMPENSATION_RULE_TYPE_LABELS, EMPLOYMENT_TYPE_LABELS } from '@/lib/constants'
import { renderToBuffer } from '@react-pdf/renderer'
import { PaymentDocument } from '@/lib/pdf/payment-document'
import type { PaymentDocumentData, WorkScheduleEntry } from '@/lib/pdf/payment-document'
import React from 'react'

interface RouteParams {
  params: Promise<{ id: string }>
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

function timeToMinutes(time: string | null): number | null {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function extractTime(datetime: string | null): string | null {
  if (!datetime) return null
  const d = new Date(datetime)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

/**
 * GET /api/payments/:id/pdf
 * 支払通知書PDF（勤務表付き）をバイナリで返す。
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    // payment_calculations 取得
    const { data: payment, error } = await supabase
      .from('payment_calculations')
      .select(`
        *,
        staff:staff_id (
          id,
          last_name,
          first_name,
          last_name_kana,
          first_name_kana,
          email,
          employment_type,
          status,
          staff_code
        )
      `)
      .eq('id', id)
      .single()

    if (error || !payment) {
      return NextResponse.json({ error: '支払い計算が見つかりません' }, { status: 404 })
    }

    // ステータスチェック: 確定済みまたは発行済みのみPDF生成可能
    if (payment.status !== 'confirmed' && payment.status !== 'issued') {
      return NextResponse.json(
        { error: '確定済みまたは発行済みの計算のみPDF生成が可能です' },
        { status: 400 }
      )
    }

    // payment_calculation_lines 取得
    const { data: lines } = await supabase
      .from('payment_calculation_lines')
      .select('*')
      .eq('payment_calculation_id', id)
      .order('sort_order', { ascending: true })

    const staff = payment.staff as {
      id: string
      last_name: string
      first_name: string
      last_name_kana: string | null
      first_name_kana: string | null
      email: string
      employment_type: string
      status: string
      staff_code: string
    } | null

    if (!staff) {
      return NextResponse.json({ error: 'スタッフ情報が見つかりません' }, { status: 404 })
    }

    // 対象月の日付範囲を計算
    const [yearStr, monthStr] = payment.year_month.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr)
    const monthStart = `${payment.year_month}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const monthEnd = `${payment.year_month}-${String(lastDay).padStart(2, '0')}`

    // シフトデータ取得（break_minutesはproject_assignmentsから取得）
    const { data: shifts } = await supabase
      .from('shifts')
      .select('shift_date, start_time, end_time, shift_type, status, project_id')
      .eq('staff_id', staff.id)
      .gte('shift_date', monthStart)
      .lte('shift_date', monthEnd)
      .is('deleted_at', null)
      .order('shift_date')

    // project_assignmentsからbreak_minutes取得
    const projectIds = [...new Set((shifts ?? []).map((s) => s.project_id))]
    const assignmentBreakMap = new Map<string, number>()
    if (projectIds.length > 0) {
      const { data: assignments } = await supabase
        .from('project_assignments')
        .select('project_id, break_minutes')
        .eq('staff_id', staff.id)
        .in('project_id', projectIds)
      for (const a of assignments ?? []) {
        assignmentBreakMap.set(a.project_id, a.break_minutes || 0)
      }
    }

    // 勤怠データ取得
    const { data: attendances } = await supabase
      .from('attendance_records')
      .select('date, clock_in, clock_out, clock_in_rounded, clock_out_rounded, break_minutes, work_minutes, overtime_minutes, note, rounding_applied')
      .eq('staff_id', staff.id)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date')

    // シフト・勤怠をマップ化
    const shiftMap = new Map<string, typeof shifts extends (infer T)[] | null ? T : never>()
    for (const s of shifts ?? []) {
      shiftMap.set(s.shift_date, s)
    }

    const attendanceMap = new Map<string, typeof attendances extends (infer T)[] | null ? T : never>()
    for (const a of attendances ?? []) {
      attendanceMap.set(a.date, a)
    }

    // 勤務表データ構築
    const workSchedule: WorkScheduleEntry[] = []
    let totalWorkDays = 0
    let totalShiftMinutes = 0
    let totalActualMinutes = 0
    let totalOvertimeMinutes = 0
    let paidLeaveDays = 0
    let absenceDays = 0

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${payment.year_month}-${String(day).padStart(2, '0')}`
      const d = new Date(year, month - 1, day)
      const dayOfWeek = DAY_NAMES[d.getDay()]

      const shift = shiftMap.get(dateStr)
      const attendance = attendanceMap.get(dateStr)

      const shiftType = shift?.shift_type || ''
      const shiftStart = shift?.start_time?.slice(0, 5) || null
      const shiftEnd = shift?.end_time?.slice(0, 5) || null
      const shiftBreak = shift ? (assignmentBreakMap.get(shift.project_id) || 0) : 0

      // シフト予定労働時間
      let shiftMinutes: number | null = null
      if (shiftStart && shiftEnd) {
        const startMin = timeToMinutes(shiftStart)
        const endMin = timeToMinutes(shiftEnd)
        if (startMin != null && endMin != null) {
          shiftMinutes = Math.max(0, endMin - startMin - shiftBreak)
        }
      }

      // 実績
      const clockInRaw = attendance?.rounding_applied
        ? attendance.clock_in_rounded
        : attendance?.clock_in
      const clockOutRaw = attendance?.rounding_applied
        ? attendance.clock_out_rounded
        : attendance?.clock_out
      const clockIn = extractTime(clockInRaw ?? null)
      const clockOut = extractTime(clockOutRaw ?? null)
      const actualBreak = attendance?.break_minutes || 0
      const workMinutes = attendance?.work_minutes ?? null
      const overtimeMinutes = attendance?.overtime_minutes || 0

      // 差異
      let diffMinutes: number | null = null
      if (workMinutes != null && shiftMinutes != null) {
        diffMinutes = workMinutes - shiftMinutes
      }

      // 集計
      if (shiftType === 'WORK' && (shift || attendance)) {
        totalWorkDays++
      }
      if (shiftType === 'PAID_LEAVE') paidLeaveDays++
      if (shiftType === 'ABSENCE') absenceDays++
      if (shiftMinutes) totalShiftMinutes += shiftMinutes
      if (workMinutes) totalActualMinutes += workMinutes
      totalOvertimeMinutes += overtimeMinutes

      // シフトも勤怠もない日（土日等）はスキップせず表示
      workSchedule.push({
        date: dateStr,
        dayOfWeek,
        shiftType,
        shiftStart,
        shiftEnd,
        shiftBreak,
        clockIn,
        clockOut,
        actualBreak,
        workMinutes,
        shiftMinutes,
        diffMinutes,
        note: attendance?.note || null,
      })
    }

    // PDF用データ構築
    const pdfData: PaymentDocumentData = {
      title: '支払通知書',
      yearMonth: payment.year_month,
      issuedDate: payment.issued_at
        ? new Date(payment.issued_at).toLocaleDateString('ja-JP')
        : new Date().toLocaleDateString('ja-JP'),
      staff: {
        name: `${staff.last_name} ${staff.first_name}`,
        nameKana: `${staff.last_name_kana || ''} ${staff.first_name_kana || ''}`.trim(),
        email: staff.email ?? '',
        employmentType: EMPLOYMENT_TYPE_LABELS[staff.employment_type ?? ''] ?? '',
        staffCode: staff.staff_code ?? '',
      },
      lines: (lines ?? []).map((line) => ({
        name: line.rule_name,
        type: COMPENSATION_RULE_TYPE_LABELS[line.rule_type] ?? line.rule_type,
        amount: line.amount,
        detail: line.detail,
      })),
      totalAmount: payment.total_amount,
      notes: payment.notes,
      workSchedule,
      workScheduleSummary: {
        totalWorkDays,
        totalShiftMinutes,
        totalActualMinutes,
        totalOvertimeMinutes,
        paidLeaveDays,
        absenceDays,
      },
    }

    // PDF生成
    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(PaymentDocument, { data: pdfData }) as any
    )

    const staffName = `${staff.last_name}${staff.first_name}`
    const filename = encodeURIComponent(`支払通知書_${staffName}_${payment.year_month}.pdf`)

    return new NextResponse(Buffer.from(buffer) as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/payments/:id/pdf error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
