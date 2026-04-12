// ロール型 + ルートアクセス制御

export type Role = 'owner' | 'admin' | 'staff'

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'オーナー',
  admin: '管理者',
  staff: 'メンバー',
}

// ロールに応じたナビゲーション表示制御
export function canAccessRoute(role: Role, path: string): boolean {
  // スタッフ（メンバー）は限定されたルートのみ
  if (role === 'staff') {
    const staffAllowed = [
      '/dashboard',
      '/attendance',
      '/shifts',
      '/reports/work',
      '/reports/performance',
    ]
    return staffAllowed.some((p) => path === p || path.startsWith(p + '/'))
  }
  // 管理者は設定・スタッフ管理・書類系を除くすべて
  if (role === 'admin') {
    const adminBlocked = ['/settings', '/staff', '/contracts', '/documents', '/invoices', '/payments', '/equipment', '/leave', '/approvals/profile']
    return !adminBlocked.some((p) => path === p || path.startsWith(p + '/'))
  }
  // オーナーは全アクセス
  return true
}
