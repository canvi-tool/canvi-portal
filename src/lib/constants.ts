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
  { value: 'CAN', label: 'CAN' },
] as const

/** ダッシュボードKPI集計から除外するプロジェクトタイプ（社内業務） */
export const INTERNAL_PROJECT_TYPES = ['CAN'] as const

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
  // 新ステータス
  proposing: '提案中',
  active: '契約中',
  ended: '契約終了',
  // 旧ステータス互換（マイグレーション前）
  planning: '提案中',
  paused: '契約終了',
  completed: '契約終了',
  archived: '契約終了',
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

export const EQUIPMENT_STATUS_LABELS: Record<string, string> = {
  available: '在庫中',
  lent: '貸与中',
  disposed: '廃棄済',
  maintenance: 'メンテナンス中',
}

export const PLEDGE_STATUS_LABELS: Record<string, string> = {
  signed: '締結済',
  sent: '送付済',
  not_submitted: '未提出',
}

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  full_day: '全日',
  half_day_am: '午前半休',
  half_day_pm: '午後半休',
  hourly: '時間休',
}

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  pending: '申請中',
  approved: '承認済み',
  rejected: '却下',
  cancelled: '取消',
}

export const SHIFT_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: '申請中',
  APPROVED: '承認済',
  NEEDS_REVISION: '修正依頼',
}

export const SHIFT_STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
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

export interface NavSection {
  title: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: '業務',
    items: [
      { label: 'ダッシュボード', href: '/dashboard', icon: 'LayoutDashboard' },
      { label: 'Canviカレンダー', href: '/shifts', icon: 'CalendarDays' },
      { label: '勤怠打刻', href: '/attendance', icon: 'Clock' },
      { label: '日次報告', href: '/reports/work', icon: 'ClipboardList' },
      { label: '月次報告', href: '/reports/performance', icon: 'BarChart3' },
    ],
  },
  {
    title: '管理',
    items: [
      { label: 'スタッフ', href: '/staff', icon: 'Users' },
      { label: 'クライアント', href: '/clients', icon: 'Building2' },
      { label: 'プロジェクト', href: '/projects', icon: 'Briefcase' },
      { label: '契約書', href: '/contracts', icon: 'FileText' },
      { label: '見積書', href: '/documents', icon: 'FileStack' },
      { label: '請求書', href: '/invoices', icon: 'Receipt' },
      { label: '有給管理', href: '/leave', icon: 'Palmtree' },
      { label: '支払通知書', href: '/payments', icon: 'Wallet' },
      { label: '貸与品管理', href: '/equipment', icon: 'Monitor' },
      { label: 'プロフィール申請承認', href: '/approvals/profile', icon: 'UserCheck' },
    ],
  },
  {
    title: 'その他',
    items: [
      { label: 'AIアラート', href: '/alerts', icon: 'Bell' },
      { label: '設定', href: '/settings', icon: 'Settings' },
    ],
  },
]

// フラット化されたNAV_ITEMS（後方互換用）
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items)
