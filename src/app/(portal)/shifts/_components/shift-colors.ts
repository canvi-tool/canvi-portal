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

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9ca3af',
  SUBMITTED: '#f59e0b',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
  NEEDS_REVISION: '#f97316',
}

export const SHIFT_TYPE_COLORS: Record<string, string> = {
  WORK: '', // PJカラーを使用
  PAID_LEAVE: '#6366f1',
  ABSENCE: '#ef4444',
  HALF_DAY_LEAVE: '#8b5cf6',
  SPECIAL_LEAVE: '#06b6d4',
}
