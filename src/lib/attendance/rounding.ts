/**
 * 打刻丸めユーティリティ (Phase 3)
 *
 * シフト時刻に対して打刻がtoleranceMinutes以内に収まる場合、
 * 打刻をシフト時刻に丸める。それ以外は生値をそのまま返す。
 *
 * すべてJST (UTC+9) で計算する。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DEFAULT_TOLERANCE_MINUTES = 10

/**
 * 日付(YYYY-MM-DD) と時刻(HH:MM or HH:MM:SS) から JST 上の絶対時刻を返す。
 * 内部的には UTC Date として返すが、JST タイムゾーン上の当該時刻を指す。
 */
export function shiftTimeToAbsolute(dateYmd: string, timeHms: string): Date {
  const [y, mo, d] = dateYmd.split('-').map(Number)
  const [h, mi] = timeHms.split(':').map(Number)
  // JST の当該日時刻 = その UTC 時刻から 9h 引いた UTC
  return new Date(Date.UTC(y, (mo || 1) - 1, d || 1, h - 9, mi || 0, 0, 0))
}

/**
 * clockIso が shiftAbs の ±tolerance 分以内なら shiftAbs を返す。
 * そうでなければ clockIso をそのまま返す。
 * 両方 ISO 文字列で返却。
 */
export function roundClockToShift(
  clockIso: string,
  shiftAbs: Date | null,
  toleranceMinutes: number = DEFAULT_TOLERANCE_MINUTES
): { rounded: string; applied: boolean } {
  if (!shiftAbs) {
    return { rounded: clockIso, applied: false }
  }
  const clock = new Date(clockIso)
  const diffMs = Math.abs(clock.getTime() - shiftAbs.getTime())
  const diffMin = diffMs / 60000
  if (diffMin <= toleranceMinutes) {
    return { rounded: shiftAbs.toISOString(), applied: true }
  }
  return { rounded: clockIso, applied: false }
}

/**
 * date(YYYY-MM-DD) と shiftTime(HH:MM[:SS]) が与えられたら打刻に対して丸めを実行。
 * shiftTime が null/undefined の場合は {rounded:clockIso, applied:false} を返す。
 */
export function applyShiftRounding(
  clockIso: string,
  dateYmd: string,
  shiftTime: string | null | undefined,
  toleranceMinutes: number = DEFAULT_TOLERANCE_MINUTES
): { rounded: string; applied: boolean } {
  if (!shiftTime) return { rounded: clockIso, applied: false }
  const shiftAbs = shiftTimeToAbsolute(dateYmd, shiftTime)
  return roundClockToShift(clockIso, shiftAbs, toleranceMinutes)
}

/** JST 日付文字列(YYYY-MM-DD)を ISO から取得 */
export function isoToJstDate(iso: string): string {
  const d = new Date(iso)
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().split('T')[0]
}
