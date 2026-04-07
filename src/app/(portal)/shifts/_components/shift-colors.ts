// PJカラーをFullCalendarのイベントカラーに変換

const PROJECT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f97316', // orange
]

const colorCache = new Map<string, string>()

export function getProjectColor(projectId: string): string {
  if (colorCache.has(projectId)) return colorCache.get(projectId)!

  let hash = 0
  for (let i = 0; i < projectId.length; i++) {
    hash = ((hash << 5) - hash + projectId.charCodeAt(i)) | 0
  }
  const color = PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length]
  colorCache.set(projectId, color)
  return color
}

// スタッフカラー: 100名前提でHSL黄金角分散により最大限の視認性を確保
// 同じstaffIdは常に同じ色、隣接するハッシュ値でも離れた色相になる
const staffColorCache = new Map<string, { solid: string; transparent: string }>()

function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getStaffColorPair(staffId: string): { solid: string; transparent: string } {
  const cached = staffColorCache.get(staffId)
  if (cached) return cached

  const hash = hashString(staffId)
  // 黄金角 (137.508°) で色相を分散、最大100種類で高い判別性
  const index = hash % 100
  const hue = (index * 137.508) % 360
  // 彩度・輝度を3段階に分けてさらに判別性UP
  const satLevels = [70, 60, 78]
  const lightLevels = [48, 42, 54]
  const variant = Math.floor(hash / 100) % 3
  const sat = satLevels[variant]
  const light = lightLevels[variant]

  const solid = `hsl(${hue.toFixed(1)}, ${sat}%, ${light}%)`
  const transparent = `hsla(${hue.toFixed(1)}, ${sat}%, ${light}%, 0.28)`
  const pair = { solid, transparent }
  staffColorCache.set(staffId, pair)
  return pair
}

export function getStaffColor(staffId: string): string {
  return getStaffColorPair(staffId).solid
}

export function getStaffColorTransparent(staffId: string): string {
  return getStaffColorPair(staffId).transparent
}

export const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: '#f59e0b',
  APPROVED: '#10b981',
  NEEDS_REVISION: '#f97316',
}

export const SHIFT_TYPE_COLORS: Record<string, string> = {
  WORK: '', // PJカラーを使用
  PAID_LEAVE: '#6366f1',
  ABSENCE: '#ef4444',
  HALF_DAY_LEAVE: '#8b5cf6',
  SPECIAL_LEAVE: '#06b6d4',
}
