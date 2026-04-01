/**
 * Google Admin SDK Directory API クライアント
 *
 * Google Workspace のユーザー・グループ管理を提供します。
 * サービスアカウント + ドメイン全体の委任を使用します。
 * googleapis 公式ライブラリを使用（UTF-8日本語対応）。
 *
 * 必要な環境変数:
 *   GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL - サービスアカウントメール
 *   GOOGLE_WORKSPACE_PRIVATE_KEY - サービスアカウント秘密鍵 (PEM形式)
 *   GOOGLE_WORKSPACE_ADMIN_EMAIL - 委任先の管理者メール
 *   GOOGLE_WORKSPACE_DOMAIN - ドメイン (例: canvi.co.jp)
 */

import { google } from 'googleapis'
import type { admin_directory_v1 } from 'googleapis'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// ============================================================
// Types
// ============================================================

export interface GoogleWorkspaceUser {
  id: string
  primaryEmail: string
  name: { givenName: string; familyName: string; fullName: string }
  suspended: boolean
  orgUnitPath: string
  creationTime: string
  lastLoginTime: string | null
  isAdmin: boolean
  aliases?: string[]
}

export interface GoogleWorkspaceGroup {
  id: string
  email: string
  name: string
  description: string
  directMembersCount: number
}

export interface CreateUserParams {
  email: string
  givenName: string
  familyName: string
  password?: string
  orgUnitPath?: string
}

// ============================================================
// Demo Data
// ============================================================

const DEMO_USERS: GoogleWorkspaceUser[] = [
  {
    id: 'gw-user-001',
    primaryEmail: 'okabayashi@canvi.co.jp',
    name: { givenName: '優治', familyName: '岡林', fullName: '岡林 優治' },
    suspended: false,
    orgUnitPath: '/管理部',
    creationTime: '2024-01-15T09:00:00Z',
    lastLoginTime: '2026-03-28T08:30:00Z',
    isAdmin: true,
    aliases: ['owner@canvi.co.jp'],
  },
  {
    id: 'gw-user-002',
    primaryEmail: 'tanaka@canvi.co.jp',
    name: { givenName: '美咲', familyName: '田中', fullName: '田中 美咲' },
    suspended: false,
    orgUnitPath: '/管理部',
    creationTime: '2024-03-01T09:00:00Z',
    lastLoginTime: '2026-03-28T09:15:00Z',
    isAdmin: false,
    aliases: [],
  },
  {
    id: 'gw-user-003',
    primaryEmail: 'sato@canvi.co.jp',
    name: { givenName: '健太', familyName: '佐藤', fullName: '佐藤 健太' },
    suspended: false,
    orgUnitPath: '/営業部',
    creationTime: '2024-06-01T09:00:00Z',
    lastLoginTime: '2026-03-27T17:45:00Z',
    isAdmin: false,
    aliases: [],
  },
  {
    id: 'gw-user-004',
    primaryEmail: 'suzuki@canvi.co.jp',
    name: { givenName: '一郎', familyName: '鈴木', fullName: '鈴木 一郎' },
    suspended: false,
    orgUnitPath: '/開発部',
    creationTime: '2024-09-15T09:00:00Z',
    lastLoginTime: '2026-03-28T10:00:00Z',
    isAdmin: false,
    aliases: [],
  },
  {
    id: 'gw-user-005',
    primaryEmail: 'yamada@canvi.co.jp',
    name: { givenName: '太郎', familyName: '山田', fullName: '山田 太郎' },
    suspended: true,
    orgUnitPath: '/営業部',
    creationTime: '2025-01-10T09:00:00Z',
    lastLoginTime: '2026-02-15T18:00:00Z',
    isAdmin: false,
    aliases: [],
  },
]

const DEMO_GROUPS: GoogleWorkspaceGroup[] = [
  {
    id: 'gw-group-001',
    email: 'all@canvi.co.jp',
    name: '全社員',
    description: '全社員向けグループ',
    directMembersCount: 5,
  },
  {
    id: 'gw-group-002',
    email: 'sales@canvi.co.jp',
    name: '営業部',
    description: '営業部門メンバー',
    directMembersCount: 2,
  },
  {
    id: 'gw-group-003',
    email: 'admin@canvi.co.jp',
    name: '管理部',
    description: '管理部門メンバー',
    directMembersCount: 2,
  },
]

// ============================================================
// googleapis Admin SDK クライアント
// ============================================================

/**
 * googleapis の Admin Directory クライアントを取得（サービスアカウント認証）
 */
function getAdminClient(): admin_directory_v1.Admin {
  const serviceAccountEmail = process.env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL
  const privateKeyPem = process.env.GOOGLE_WORKSPACE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const adminEmail = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL

  if (!serviceAccountEmail || !privateKeyPem || !adminEmail) {
    throw new GoogleWorkspaceError(
      'CONFIG_ERROR',
      'Google Workspace のサービスアカウント設定が不足しています',
      0
    )
  }

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKeyPem,
    scopes: [
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/admin.directory.group',
    ],
    subject: adminEmail,
  })

  return google.admin({ version: 'directory_v1', auth })
}

function generatePassword(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b: number) => chars[b % chars.length])
    .join('')
}

// ============================================================
// User Management
// ============================================================

/**
 * ドメイン内のユーザー一覧を取得
 */
export async function listUsers(
  domain: string,
  query?: string
): Promise<GoogleWorkspaceUser[]> {
  if (DEMO_MODE) {
    let users = [...DEMO_USERS]
    if (query) {
      const q = query.toLowerCase()
      users = users.filter(
        (u) =>
          u.primaryEmail.toLowerCase().includes(q) ||
          u.name.fullName.toLowerCase().includes(q)
      )
    }
    return users
  }

  const admin = getAdminClient()
  const res = await admin.users.list({
    domain,
    maxResults: 500,
    orderBy: 'email',
    ...(query ? { query } : {}),
  })

  return (res.data.users || []).map((u) => mapGapiUser(u))
}

/**
 * ユーザーが存在するかチェック（存在すればtrue）
 */
export async function userExists(email: string): Promise<boolean> {
  if (DEMO_MODE) {
    return DEMO_USERS.some((u) => u.primaryEmail === email)
  }

  try {
    const admin = getAdminClient()
    await admin.users.get({ userKey: email })
    return true
  } catch (err: unknown) {
    const gErr = err as { code?: number }
    if (gErr.code === 404) {
      return false
    }
    throw wrapGapiError(err)
  }
}

/**
 * 重複しないメールアドレスを自動解決
 * 基本: prefix@domain → 重複時: prefix002@domain, prefix003@domain ...
 */
export async function resolveAvailableEmail(
  prefix: string,
  domain: string
): Promise<{ email: string; suffix: string | null }> {
  const baseEmail = `${prefix}@${domain}`
  if (!(await userExists(baseEmail))) {
    return { email: baseEmail, suffix: null }
  }

  for (let i = 2; i <= 99; i++) {
    const suffix = String(i).padStart(3, '0')
    const candidateEmail = `${prefix}${suffix}@${domain}`
    if (!(await userExists(candidateEmail))) {
      return { email: candidateEmail, suffix }
    }
  }

  throw new GoogleWorkspaceError(
    'EMAIL_EXHAUSTED',
    `利用可能なメールアドレスが見つかりません: ${prefix}@${domain}`,
    409
  )
}

/**
 * ユーザー詳細を取得
 */
export async function getUser(email: string): Promise<GoogleWorkspaceUser> {
  if (DEMO_MODE) {
    const user = DEMO_USERS.find((u) => u.primaryEmail === email)
    if (!user) {
      throw new GoogleWorkspaceError('NOT_FOUND', `ユーザーが見つかりません: ${email}`, 404)
    }
    return user
  }

  try {
    const admin = getAdminClient()
    const res = await admin.users.get({ userKey: email })
    return mapGapiUser(res.data)
  } catch (err) {
    throw wrapGapiError(err)
  }
}

/**
 * ユーザーを作成
 */
export async function createUser(params: CreateUserParams): Promise<GoogleWorkspaceUser> {
  if (DEMO_MODE) {
    const newUser: GoogleWorkspaceUser = {
      id: `gw-user-${Date.now()}`,
      primaryEmail: params.email,
      name: {
        givenName: params.givenName,
        familyName: params.familyName,
        fullName: `${params.familyName} ${params.givenName}`,
      },
      suspended: false,
      orgUnitPath: params.orgUnitPath || '/',
      creationTime: new Date().toISOString(),
      lastLoginTime: null,
      isAdmin: false,
      aliases: [],
    }
    return newUser
  }

  const password = params.password || generatePassword()

  try {
    const admin = getAdminClient()
    const res = await admin.users.insert({
      requestBody: {
        primaryEmail: params.email,
        name: {
          givenName: params.givenName,
          familyName: params.familyName,
        },
        password,
        changePasswordAtNextLogin: !params.password,
        orgUnitPath: params.orgUnitPath || '/',
      },
    })
    return mapGapiUser(res.data)
  } catch (err) {
    throw wrapGapiError(err)
  }
}

/**
 * ユーザー情報を更新（名前・OU等）
 */
export async function updateUser(
  email: string,
  updates: { givenName?: string; familyName?: string; orgUnitPath?: string; password?: string; changePasswordAtNextLogin?: boolean }
): Promise<GoogleWorkspaceUser> {
  if (DEMO_MODE) {
    const user = DEMO_USERS.find((u) => u.primaryEmail === email)
    if (!user) {
      throw new GoogleWorkspaceError('NOT_FOUND', `ユーザーが見つかりません: ${email}`, 404)
    }
    return {
      ...user,
      name: {
        givenName: updates.givenName || user.name.givenName,
        familyName: updates.familyName || user.name.familyName,
        fullName: `${updates.familyName || user.name.familyName} ${updates.givenName || user.name.givenName}`,
      },
    }
  }

  const requestBody: admin_directory_v1.Schema$User = {}
  if (updates.givenName || updates.familyName) {
    requestBody.name = {
      ...(updates.givenName ? { givenName: updates.givenName } : {}),
      ...(updates.familyName ? { familyName: updates.familyName } : {}),
    }
  }
  if (updates.orgUnitPath) {
    requestBody.orgUnitPath = updates.orgUnitPath
  }
  if (updates.password) {
    requestBody.password = updates.password
    requestBody.changePasswordAtNextLogin = updates.changePasswordAtNextLogin ?? false
  }

  try {
    const admin = getAdminClient()
    const res = await admin.users.patch({
      userKey: email,
      requestBody,
    })
    return mapGapiUser(res.data)
  } catch (err) {
    throw wrapGapiError(err)
  }
}

/**
 * ユーザーを停止
 */
export async function suspendUser(email: string): Promise<GoogleWorkspaceUser> {
  if (DEMO_MODE) {
    const user = DEMO_USERS.find((u) => u.primaryEmail === email)
    if (!user) {
      throw new GoogleWorkspaceError('NOT_FOUND', `ユーザーが見つかりません: ${email}`, 404)
    }
    return { ...user, suspended: true }
  }

  try {
    const admin = getAdminClient()
    const res = await admin.users.update({
      userKey: email,
      requestBody: { suspended: true },
    })
    return mapGapiUser(res.data)
  } catch (err) {
    throw wrapGapiError(err)
  }
}

/**
 * ユーザーを再有効化
 */
export async function unsuspendUser(email: string): Promise<GoogleWorkspaceUser> {
  if (DEMO_MODE) {
    const user = DEMO_USERS.find((u) => u.primaryEmail === email)
    if (!user) {
      throw new GoogleWorkspaceError('NOT_FOUND', `ユーザーが見つかりません: ${email}`, 404)
    }
    return { ...user, suspended: false }
  }

  try {
    const admin = getAdminClient()
    const res = await admin.users.update({
      userKey: email,
      requestBody: { suspended: false },
    })
    return mapGapiUser(res.data)
  } catch (err) {
    throw wrapGapiError(err)
  }
}

/**
 * ユーザーを削除
 */
export async function deleteUser(email: string): Promise<void> {
  if (DEMO_MODE) {
    const user = DEMO_USERS.find((u) => u.primaryEmail === email)
    if (!user) {
      throw new GoogleWorkspaceError('NOT_FOUND', `ユーザーが見つかりません: ${email}`, 404)
    }
    return
  }

  try {
    const admin = getAdminClient()
    await admin.users.delete({ userKey: email })
  } catch (err) {
    throw wrapGapiError(err)
  }
}

/**
 * パスワードをリセット
 */
export async function resetPassword(
  email: string,
  newPassword?: string
): Promise<{ password: string }> {
  const password = newPassword || generatePassword()

  if (DEMO_MODE) {
    const user = DEMO_USERS.find((u) => u.primaryEmail === email)
    if (!user) {
      throw new GoogleWorkspaceError('NOT_FOUND', `ユーザーが見つかりません: ${email}`, 404)
    }
    return { password }
  }

  try {
    const admin = getAdminClient()
    await admin.users.update({
      userKey: email,
      requestBody: {
        password,
        changePasswordAtNextLogin: true,
      },
    })
    return { password }
  } catch (err) {
    throw wrapGapiError(err)
  }
}

// ============================================================
// Group Management
// ============================================================

/**
 * グループ一覧を取得
 */
export async function listGroups(domain: string): Promise<GoogleWorkspaceGroup[]> {
  if (DEMO_MODE) {
    return [...DEMO_GROUPS]
  }

  try {
    const admin = getAdminClient()
    const res = await admin.groups.list({
      domain,
      maxResults: 200,
    })
    return (res.data.groups || []).map(mapGapiGroup)
  } catch (err) {
    throw wrapGapiError(err)
  }
}

/**
 * ユーザーをグループに追加
 */
export async function addUserToGroup(
  groupEmail: string,
  userEmail: string
): Promise<void> {
  if (DEMO_MODE) {
    return
  }

  try {
    const admin = getAdminClient()
    await admin.members.insert({
      groupKey: groupEmail,
      requestBody: {
        email: userEmail,
        role: 'MEMBER',
      },
    })
  } catch (err) {
    throw wrapGapiError(err)
  }
}

/**
 * ユーザーをグループから削除
 */
export async function removeUserFromGroup(
  groupEmail: string,
  userEmail: string
): Promise<void> {
  if (DEMO_MODE) {
    return
  }

  try {
    const admin = getAdminClient()
    await admin.members.delete({
      groupKey: groupEmail,
      memberKey: userEmail,
    })
  } catch (err) {
    throw wrapGapiError(err)
  }
}

// ============================================================
// Mapping Helpers
// ============================================================

function mapGapiUser(data: admin_directory_v1.Schema$User): GoogleWorkspaceUser {
  const name = data.name || {}
  return {
    id: data.id || '',
    primaryEmail: data.primaryEmail || '',
    name: {
      givenName: name.givenName || '',
      familyName: name.familyName || '',
      fullName: name.fullName || `${name.familyName || ''} ${name.givenName || ''}`.trim(),
    },
    suspended: data.suspended || false,
    orgUnitPath: data.orgUnitPath || '/',
    creationTime: data.creationTime || '',
    lastLoginTime: data.lastLoginTime || null,
    isAdmin: data.isAdmin || false,
    aliases: (data.aliases as string[]) || [],
  }
}

function mapGapiGroup(data: admin_directory_v1.Schema$Group): GoogleWorkspaceGroup {
  return {
    id: data.id || '',
    email: data.email || '',
    name: data.name || '',
    description: data.description || '',
    directMembersCount: Number(data.directMembersCount) || 0,
  }
}

// ============================================================
// Error Helpers
// ============================================================

/**
 * googleapis エラーを GoogleWorkspaceError に変換
 */
function wrapGapiError(err: unknown): GoogleWorkspaceError {
  if (err instanceof GoogleWorkspaceError) return err

  const gErr = err as {
    code?: number
    message?: string
    errors?: Array<{ message?: string }>
  }
  const statusCode = gErr.code || 500
  const message =
    gErr.errors?.[0]?.message ||
    gErr.message ||
    'Google Workspace APIエラーが発生しました'

  return new GoogleWorkspaceError(`API_ERROR_${statusCode}`, message, statusCode)
}

// ============================================================
// Error Class
// ============================================================

export class GoogleWorkspaceError extends Error {
  code: string
  statusCode: number

  constructor(code: string, message: string, statusCode: number) {
    super(message)
    this.name = 'GoogleWorkspaceError'
    this.code = code
    this.statusCode = statusCode
  }
}
