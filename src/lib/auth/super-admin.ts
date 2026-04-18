// ============================================================
// Super Admin (株式会社Canvi 全サービス管理者) の判定
// Portal の platform-owner よりさらに狭い、全サービステナント CRUD 権限。
// ============================================================

import { NextResponse } from 'next/server'
import type { UserWithRole } from '@/lib/auth/rbac'

export const SUPER_ADMIN_EMAILS = [
  'yuji.okabayashi@canvi.co.jp',
  'tsutomu.hokugo@canvi.co.jp',
]

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase())
}

export function isSuperAdmin(user: UserWithRole | null | undefined): boolean {
  return isSuperAdminEmail(user?.email ?? null)
}

/**
 * API ガード。super admin でなければ 401/403 を返す。
 * 通過時は null を返す。
 */
export function requireSuperAdmin(
  user: UserWithRole | null | undefined,
): NextResponse | null {
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  return null
}
