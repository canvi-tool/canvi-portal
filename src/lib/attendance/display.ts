/**
 * 勤怠表示用ユーティリティ
 *  - シフト時刻に対して±15分以内の打刻はシフト時刻に丸める
 *  - 雇用スタッフ(正社員/契約/パート)で実働5h以上の場合は休憩60分を強制
 *  - 業務委託/役員は休憩0分
 *  - 表示は「丸め後（実打刻）」形式
 */

const ROUND_TOLERANCE_MIN = 15

export function formatTime(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })
}

export function formatMinutes(minutes: number | null | undefined) {
  if (minutes == null) return '-'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

export function formatTimeWithRaw(rounded: string | null | undefined, raw: string | null | undefined) {
  const roundedStr = formatTime(rounded || raw)
  if (!rounded || !raw || rounded === raw) return roundedStr
  return `${roundedStr}（${formatTime(raw)}）`
}

export function formatBreakWithRaw(rounded: number | null, raw: number | null | undefined) {
  if (rounded == null && (raw == null || raw === 0)) return '-'
  const r = rounded ?? 0
  const rawVal = raw ?? 0
  if (r === rawVal) return r === 0 ? '-' : `${r}分`
  return `${r}分（${rawVal}分）`
}

export function formatMinutesWithRaw(rounded: number | null, raw: number | null | undefined) {
  if (rounded == null && raw == null) return '-'
  const roundedStr = rounded != null ? formatMinutes(rounded) : '-'
  if (rounded == null || raw == null || rounded === raw) return roundedStr
  return `${roundedStr}（${formatMinutes(raw)}）`
}

function jstDateTimeToIso(date: string, hms: string): string {
  return new Date(`${date}T${hms.slice(0, 5)}:00+09:00`).toISOString()
}

function roundClockToShiftIso(
  clockIso: string | null | undefined,
  shiftHms: string | null | undefined,
  date: string
): string | null {
  if (!clockIso || !shiftHms || !date) return clockIso ?? null
  const shiftIso = jstDateTimeToIso(date, shiftHms)
  const diffMin = Math.abs(new Date(clockIso).getTime() - new Date(shiftIso).getTime()) / 60000
  return diffMin <= ROUND_TOLERANCE_MIN ? shiftIso : clockIso
}

export function isEmployedStaff(employmentType?: string | null): boolean {
  return !(employmentType === 'freelance' || employmentType === 'executive')
}

export interface RoundableRecord {
  date: string
  clock_in?: string | null
  clock_out?: string | null
  break_minutes?: number | null
  work_minutes?: number | null
  shift_start_time?: string | null
  shift_end_time?: string | null
  staff?: { employment_type?: string | null } | null
}

export function computeRoundedDisplay(rec: RoundableRecord) {
  const roundedIn = roundClockToShiftIso(rec.clock_in, rec.shift_start_time, rec.date)
  const roundedOut = roundClockToShiftIso(rec.clock_out, rec.shift_end_time, rec.date)

  let roundedWorkMinutes: number | null = null
  let roundedBreakMinutes: number | null = rec.break_minutes ?? null
  if (roundedIn && roundedOut) {
    const grossMin = Math.max(
      0,
      Math.floor((new Date(roundedOut).getTime() - new Date(roundedIn).getTime()) / 60000)
    )
    const employed = isEmployedStaff(rec.staff?.employment_type)
    if (employed && grossMin >= 300) {
      roundedBreakMinutes = 60
    } else if (!employed) {
      roundedBreakMinutes = 0
    }
    roundedWorkMinutes = Math.max(0, grossMin - (roundedBreakMinutes ?? 0))
  }
  return { roundedIn, roundedOut, roundedBreakMinutes, roundedWorkMinutes }
}
