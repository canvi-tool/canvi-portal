/**
 * Google Admin SDK Directory API クライアント
 *
 * Google Workspace のユーザー・グループ管理を提供します。
 * サービスアカウント + ドメイン全体の委任を使用します。
 *
 * 必要な環境変数:
 *   GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL - サービスアカウントメール
 *   GOOGLE_WORKSPACE_PRIVATE_KEY - サービスアカウント秘密鍵 (PEM形式)
 *   GOOGLE_WORKSPACE_ADMIN_EMAIL - 委任先の管理者メール
 *   GOOGLE_WORKSPACE_DOMAIN - ドメイン (例: canvi.co.jp)
 */

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const ADMIN_API_BASE = 'https://admin.googleapis.com/admin/directory/v1'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

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
// JWT / Access Token
// ============================================================

/**
 * Base64URL エンコード
 */
function base64urlEncode(data: string): string {
  const base64 = Buffer.from(data).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * サービスアカウントの JWT を生成し、アクセストークンを取得する
 */
async function getAccessToken(): Promise<string> {
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

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: serviceAccountEmail,
    sub: adminEmail,
    scope: 'https://www.googleapis.com/auth/admin.directory.user https://www.googleapis.com/auth/admin.directory.group',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }

  const headerB64 = base64urlEncode(JSON.stringify(header))
  const payloadB64 = base64urlEncode(JSON.stringify(payload))
  const unsignedToken = `${headerB64}.${payloadB64}`

  // Sign with RSA-SHA256 using Node.js crypto
  const crypto = await import('crypto')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(unsignedToken)
  const signature = sign.sign(privateKeyPem, 'base64')
  const signatureB64 = signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const jwt = `${unsignedToken}.${signatureB64}`

  // Exchange JWT for access token
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new GoogleWorkspaceError(
      'AUTH_ERROR',
      `アクセストークンの取得に失敗しました: ${error.error_description || res.statusText}`,
      res.status
    )
  }

  const data = await res.json()
  return data.access_token
}

// ============================================================
// API Helpers
// ============================================================

async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const accessToken = await getAccessToken()
  const url = `${ADMIN_API_BASE}${path}`

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({
      error: { message: `HTTP ${res.status}: ${res.statusText}` },
    }))
    throw new GoogleWorkspaceError(
      `API_ERROR_${res.status}`,
      errorBody.error?.message || `APIリクエストに失敗しました (HTTP ${res.status})`,
      res.status
    )
  }

  // DELETE returns 204 No Content
  if (res.status === 204) {
    return {} as T
  }

  return (await res.json()) as T
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

  const params = new URLSearchParams({
    domain,
    maxResults: '500',
    orderBy: 'email',
  })
  if (query) {
    params.set('query', query)
  }

  const data = await apiRequest<{ users?: Record<string, unknown>[] }>(
    'GET',
    `/users?${params.toString()}`
  )
  return (data.users || []).map((u) => mapApiUser(u))
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

  const data = await apiRequest<Record<string, unknown>>('GET', `/users/${encodeURIComponent(email)}`)
  return mapApiUser(data)
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

  const body = {
    primaryEmail: params.email,
    name: {
      givenName: params.givenName,
      familyName: params.familyName,
    },
    password,
    changePasswordAtNextLogin: !params.password,
    orgUnitPath: params.orgUnitPath || '/',
  }

  const data = await apiRequest<Record<string, unknown>>('POST', '/users', body)
  return mapApiUser(data)
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

  const data = await apiRequest<Record<string, unknown>>(
    'PUT',
    `/users/${encodeURIComponent(email)}`,
    { suspended: true }
  )
  return mapApiUser(data)
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

  const data = await apiRequest<Record<string, unknown>>(
    'PUT',
    `/users/${encodeURIComponent(email)}`,
    { suspended: false }
  )
  return mapApiUser(data)
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

  await apiRequest<void>('DELETE', `/users/${encodeURIComponent(email)}`)
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

  await apiRequest<Record<string, unknown>>(
    'PUT',
    `/users/${encodeURIComponent(email)}`,
    {
      password,
      changePasswordAtNextLogin: true,
    }
  )

  return { password }
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

  const params = new URLSearchParams({
    domain,
    maxResults: '200',
  })

  const data = await apiRequest<{ groups?: Record<string, unknown>[] }>(
    'GET',
    `/groups?${params.toString()}`
  )
  return (data.groups || []).map(mapApiGroup)
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

  await apiRequest('POST', `/groups/${encodeURIComponent(groupEmail)}/members`, {
    email: userEmail,
    role: 'MEMBER',
  })
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

  await apiRequest(
    'DELETE',
    `/groups/${encodeURIComponent(groupEmail)}/members/${encodeURIComponent(userEmail)}`
  )
}

// ============================================================
// Mapping Helpers
// ============================================================

function mapApiUser(data: Record<string, unknown>): GoogleWorkspaceUser {
  const name = (data.name as Record<string, string>) || {}
  return {
    id: (data.id as string) || '',
    primaryEmail: (data.primaryEmail as string) || '',
    name: {
      givenName: name.givenName || '',
      familyName: name.familyName || '',
      fullName: name.fullName || `${name.familyName || ''} ${name.givenName || ''}`.trim(),
    },
    suspended: (data.suspended as boolean) || false,
    orgUnitPath: (data.orgUnitPath as string) || '/',
    creationTime: (data.creationTime as string) || '',
    lastLoginTime: (data.lastLoginTime as string) || null,
    isAdmin: (data.isAdmin as boolean) || false,
    aliases: (data.aliases as string[]) || [],
  }
}

function mapApiGroup(data: Record<string, unknown>): GoogleWorkspaceGroup {
  return {
    id: (data.id as string) || '',
    email: (data.email as string) || '',
    name: (data.name as string) || '',
    description: (data.description as string) || '',
    directMembersCount: Number(data.directMembersCount) || 0,
  }
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
