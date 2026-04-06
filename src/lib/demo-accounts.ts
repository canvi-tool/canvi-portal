// デモモード用テストアカウント定義

export type DemoRole = 'owner' | 'admin' | 'staff'

export interface DemoAccount {
  id: string
  role: DemoRole
  roleLabelJa: string
  name: string
  email: string
  avatarInitial: string
  description: string
  permissions: string[]
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 'demo-owner-001',
    role: 'owner',
    roleLabelJa: 'オーナー',
    name: '岡林 優治',
    email: 'okabayashi@canvi.co.jp',
    avatarInitial: '岡',
    description: '全機能へのアクセス、設定変更、権限管理、報酬ルール変更',
    permissions: [
      'スタッフ管理（全操作）',
      '契約管理（全操作）',
      'PJ管理（全操作）',
      '支払管理（確定・発行）',
      '設定変更',
      '権限管理',
      '報酬ルール変更',
    ],
  },
  {
    id: 'demo-admin-001',
    role: 'admin',
    roleLabelJa: '管理者',
    name: '田中 美咲',
    email: 'tanaka@canvi.co.jp',
    avatarInitial: '田',
    description: '日常運用、計算確認、契約送付、通知書発行',
    permissions: [
      'スタッフ管理（閲覧・編集）',
      '契約管理（閲覧・送付）',
      'PJ管理（閲覧・アサイン）',
      '支払管理（確認・修正）',
      '勤務報告承認',
      'シフト管理',
      'アラート確認',
    ],
  },
  {
    id: 'demo-staff-001',
    role: 'staff',
    roleLabelJa: 'メンバー',
    name: '佐藤 健太',
    email: 'sato@example.com',
    avatarInitial: '佐',
    description: '所属PJ・自分のシフト/報告/実績/アラートのみ',
    permissions: [
      '所属プロジェクト（閲覧のみ）',
      '自分のシフト確認',
      '自分の勤務報告（入力・確認）',
      '自分の業務実績（閲覧）',
      '自分のダッシュボード',
      '自分のアラート確認',
    ],
  },
]

export function getDemoAccountByRole(role: DemoRole): DemoAccount {
  return DEMO_ACCOUNTS.find((a) => a.role === role) || DEMO_ACCOUNTS[0]
}

export function getDemoAccountFromCookie(): DemoAccount | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/demo_role=(\w+)/)
  if (!match) return null
  return getDemoAccountByRole(match[1] as DemoRole)
}

export function setDemoRoleCookie(role: DemoRole): void {
  document.cookie = `demo_role=${role};path=/;max-age=${60 * 60 * 24 * 30}`
}

// ロールに応じたナビゲーション表示制御
export function canAccessRoute(role: DemoRole, path: string): boolean {
  // スタッフ（メンバー）は限定されたルートのみ
  if (role === 'staff') {
    const staffAllowed = [
      '/dashboard',
      '/attendance',
      '/shifts',
      '/reports/work',
      '/reports/performance',
      '/alerts',
    ]
    return staffAllowed.some((p) => path === p || path.startsWith(p + '/'))
  }
  // 管理者は設定・スタッフ管理・書類系を除くすべて
  if (role === 'admin') {
    const adminBlocked = ['/settings', '/staff', '/contracts', '/documents', '/invoices', '/payments']
    return !adminBlocked.some((p) => path === p || path.startsWith(p + '/'))
  }
  // オーナーは全アクセス
  return true
}
