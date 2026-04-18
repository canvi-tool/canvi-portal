// ロール型 + ルートアクセス制御

export type Role = 'owner' | 'admin' | 'staff'

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'オーナー',
  admin: '管理者',
  staff: 'メンバー',
}

/** プラットフォーム管理者（岡林）専用パス。ロール問わず email でガードされる */
export const PLATFORM_OWNER_ONLY_PATHS = [
  '/admin/services',
  '/admin/users/invite',
  '/admin/audit-logs',
]

/** プラットフォーム管理者のメールアドレス（client-safeな定数） */
export const PLATFORM_OWNER_EMAILS_CLIENT = ['yuji.okabayashi@canvi.co.jp']
export function isPlatformOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return PLATFORM_OWNER_EMAILS_CLIENT.includes(email.toLowerCase())
}

/** path がプラットフォーム管理者専用か判定 */
export function isPlatformOwnerOnlyPath(path: string): boolean {
  return PLATFORM_OWNER_ONLY_PATHS.some((p) => path === p || path.startsWith(p + '/'))
}

// ロールに応じたナビゲーション表示制御
export function canAccessRoute(role: Role, path: string): boolean {
  // プラットフォーム管理者専用パス: ロールではブロック（別途 email check が入る）
  if (isPlatformOwnerOnlyPath(path)) {
    return false
  }
  // スタッフ（メンバー）は限定されたルートのみ
  if (role === 'staff') {
    const staffAllowed = [
      '/dashboard',
      '/apps',
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
