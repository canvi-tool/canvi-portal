export const APP_NAME = 'Canvi Portal'
export const APP_DESCRIPTION = 'Canvi業務総合ポータル'

/** ログインを許可するメールドメイン（小文字） */
export const ALLOWED_EMAIL_DOMAINS = ['canvi.co.jp']

export const STAFF_STATUS_LABELS: Record<string, string> = {
  pending_registration: '登録待ち',
  pending_approval: '承認待ち',
  pre_contract: '契約前',
  contract_sent: '契約送付済',
  pending_signature: '締結待ち',
  active: '稼働中',
  on_leave: '休止中',
  retired: '退職/離任',
}

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: '正社員',
  part_time: 'パートタイム',
  contract: '契約社員',
  temporary: '派遣社員',
  freelance: 'フリーランス/業務委託',
  executive: '役員',
  other: 'その他',
}

export const PROJECT_TYPE_OPTIONS = [
  { value: 'BPO', label: 'BPO' },
  { value: 'RPO', label: 'RPO' },
  { value: 'ETC', label: 'ETC' },
] as const

export type ProjectType = typeof PROJECT_TYPE_OPTIONS[number]['value']

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  active: '有効',
  inactive: '無効',
}

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  pending_signature: '署名待ち',
  signed: '署名済',
  active: '有効',
  expired: '期限切れ',
  terminated: '終了',
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: '計画中',
  active: '稼働中',
  paused: '一時停止',
  completed: '完了',
  archived: 'アーカイブ',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  aggregated: '集計済',
  needs_review: '要確認',
  confirmed: '確定済',
  issued: '発行済',
}

export const COMPENSATION_RULE_TYPE_LABELS: Record<string, string> = {
  time_rate: '時間単価',
  count_rate: '件数単価',
  standby_rate: '待機単価',
  monthly_fixed: '月額固定',
  fixed_plus_variable: '固定+変動',
  percentage: '率計算',
  adjustment: '調整/経費',
}

export const REPORT_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  submitted: '提出済',
  approved: '承認済',
  rejected: '差戻し',
}

export const ALERT_TYPE_LABELS: Record<string, string> = {
  unreported_work: '未報告',
  shift_discrepancy: 'シフト差異',
  unsigned_contract: '契約未締結',
  failed_notification: '送付失敗',
  unsigned_retirement_doc: '退職書類未締結',
  anomaly_detected: '異常検知',
}

export const ALERT_SEVERITY_LABELS: Record<string, string> = {
  info: '情報',
  warning: '警告',
  critical: '重大',
}

export const ESTIMATE_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  sent: '送付済',
  accepted: '承認済',
  rejected: '却下',
  expired: '期限切れ',
}

export const PROJECT_CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  pending_signature: '署名待ち',
  signed: '署名済',
  active: '有効',
  expired: '期限切れ',
  terminated: '終了',
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  sent: '送付済',
  paid: '入金済',
  overdue: '支払遅延',
  cancelled: 'キャンセル',
}

export const SHIFT_STATUS_LABELS: Record<string, string> = {
  DRAFT: '下書き',
  SUBMITTED: '申請済',
  APPROVED: '承認済',
  REJECTED: '却下',
  NEEDS_REVISION: '修正依頼',
}

export const SHIFT_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  NEEDS_REVISION: 'bg-orange-100 text-orange-700',
}

export const SHIFT_APPROVAL_MODE_LABELS: Record<string, string> = {
  AUTO: '自動確定',
  APPROVAL: '承認制',
}

export interface NavItem {
  label: string
  href: string
  icon: string
  badge?: number
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'ダッシュボード', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'スタッフ管理', href: '/staff', icon: 'Users' },
  { label: 'クライアント管理', href: '/clients', icon: 'Building2' },
  { label: '契約管理', href: '/contracts', icon: 'FileText' },
  { label: 'プロジェクト', href: '/projects', icon: 'Briefcase' },
  { label: '書類管理', href: '/documents', icon: 'FileStack' },
  { label: 'シフト管理', href: '/shifts', icon: 'CalendarDays' },
  { label: '勤務報告', href: '/reports/work', icon: 'ClipboardList' },
  { label: '業務実績', href: '/reports/performance', icon: 'BarChart3' },
  { label: '支払管理', href: '/payments', icon: 'Wallet' },
  { label: '退職・離任', href: '/retirement', icon: 'UserMinus' },
  { label: 'アラート', href: '/alerts', icon: 'Bell' },
  { label: '設定', href: '/settings', icon: 'Settings' },
  { label: 'アカウント管理', href: '/accounts', icon: 'KeyRound' },
]
