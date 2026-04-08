import { isJpHoliday } from '@/lib/jp-holidays'

export interface BusyInterval { start: string; end: string }

export interface ComputeSlotsParams {
  memberIds: string[]
  memberBusy: Record<string, BusyInterval[]>
  mode: 'all_free' | 'any_free'
  dateRangeStart: string // YYYY-MM-DD (inclusive)
  dateRangeEnd: string   // YYYY-MM-DD (inclusive)
  timeRangeStart: string // HH:mm
  timeRangeEnd: string   // HH:mm
  durationMinutes: number
  bookedSlots?: BusyInterval[]
  /** 0=Sun..6=Sat。空/undefinedで全曜日許可 */
  weekdays?: number[]
  /** 日本の祝日を除外するか */
  excludeHolidays?: boolean
}

export interface AvailableSlot {
  start: string
  end: string
  date: string
  startTime: string
  endTime: string
}

export function computeAvailableSlots(p: ComputeSlotsParams): AvailableSlot[] {
  const slots: AvailableSlot[] = []
  const slotMs = p.durationMinutes * 60 * 1000
  const stepMs = 30 * 60 * 1000

  // Generate date range
  const dates: string[] = []
  const [sy, sm, sd] = p.dateRangeStart.split('-').map(Number)
  const [ey, em, ed] = p.dateRangeEnd.split('-').map(Number)
  const startD = new Date(sy, sm - 1, sd)
  const endD = new Date(ey, em - 1, ed)
  for (const d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    dates.push(`${yyyy}-${mm}-${dd}`)
  }

  // 翌日以降のみ
  const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const todayStr = `${nowJST.getUTCFullYear()}-${String(nowJST.getUTCMonth() + 1).padStart(2, '0')}-${String(nowJST.getUTCDate()).padStart(2, '0')}`

  const wdSet = (p.weekdays && p.weekdays.length > 0) ? new Set(p.weekdays) : null
  const booked = p.bookedSlots ?? []

  for (const dateStr of dates) {
    if (dateStr <= todayStr) continue // 翌日以降
    if (p.excludeHolidays && isJpHoliday(dateStr)) continue
    const [y, m, d] = dateStr.split('-').map(Number)
    const wd = new Date(y, m - 1, d).getDay()
    if (wdSet && !wdSet.has(wd)) continue

    const dayStart = new Date(`${dateStr}T${p.timeRangeStart}:00+09:00`).getTime()
    const dayEnd = new Date(`${dateStr}T${p.timeRangeEnd}:00+09:00`).getTime()

    for (let t = dayStart; t + slotMs <= dayEnd; t += stepMs) {
      const slotStart = t
      const slotEnd = t + slotMs

      const isBooked = booked.some(b => {
        const bs = new Date(b.start).getTime()
        const be = new Date(b.end).getTime()
        return slotStart < be && slotEnd > bs
      })
      if (isBooked) continue

      if (p.mode === 'all_free') {
        const allFree = p.memberIds.every(id => {
          const busy = p.memberBusy[id] || []
          return !busy.some(b => {
            const bs = new Date(b.start).getTime()
            const be = new Date(b.end).getTime()
            return slotStart < be && slotEnd > bs
          })
        })
        if (!allFree) continue
      } else {
        const anyFree = p.memberIds.some(id => {
          const busy = p.memberBusy[id] || []
          return !busy.some(b => {
            const bs = new Date(b.start).getTime()
            const be = new Date(b.end).getTime()
            return slotStart < be && slotEnd > bs
          })
        })
        if (!anyFree) continue
      }

      slots.push({
        start: new Date(slotStart).toISOString(),
        end: new Date(slotEnd).toISOString(),
        date: dateStr,
        startTime: formatTimeJST(slotStart),
        endTime: formatTimeJST(slotEnd),
      })
    }
  }

  return slots
}

function formatTimeJST(ms: number): string {
  const d = new Date(ms)
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`
}
