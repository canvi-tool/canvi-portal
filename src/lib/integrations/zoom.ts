/**
 * Zoom Server-to-Server OAuth API クライアント
 *
 * Zoomユーザー管理との連携を提供します。
 * 環境変数で認証情報を設定してください。
 *
 * 必要な環境変数:
 *   ZOOM_ACCOUNT_ID - Zoom Server-to-Server OAuthアカウントID
 *   ZOOM_CLIENT_ID - Zoom OAuthクライアントID
 *   ZOOM_CLIENT_SECRET - Zoom OAuthクライアントシークレット
 */

// ============================================================
// Types
// ============================================================

export interface ZoomUser {
  id: string
  email: string
  first_name: string
  last_name: string
  display_name: string
  type: number // 1=Basic, 2=Licensed, 3=On-Prem
  status: 'active' | 'inactive' | 'pending'
  created_at: string
  last_login_time: string | null
  phone_numbers?: ZoomPhoneNumber[]
}

export interface ZoomPhoneNumber {
  id: string
  number: string
  display_name: string
  type: 'toll' | 'tollfree'
  assignee_type: 'user' | 'callQueue' | 'autoReceptionist'
}

export interface CreateZoomUserParams {
  email: string
  first_name: string
  last_name: string
  type?: number // 1=Basic, 2=Licensed (default: 1)
}

export interface UpdateZoomUserStatusParams {
  status: 'activate' | 'deactivate'
}

interface ZoomListUsersResponse {
  page_count: number
  page_number: number
  page_size: number
  total_records: number
  users: ZoomUser[]
}

interface ZoomTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

// ============================================================
// Client
// ============================================================

let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Server-to-Server OAuthアクセストークンを取得する
 * トークンはメモリにキャッシュされ、期限切れ前に自動更新される
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now()

  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET

  if (!accountId || !clientId || !clientSecret) {
    throw new ZoomApiError(
      'CONFIG_ERROR',
      'Zoom API認証情報が設定されていません。環境変数を確認してください。',
      0
    )
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: accountId,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ZoomApiError(
      'AUTH_ERROR',
      `Zoomアクセストークンの取得に失敗しました (HTTP ${res.status}): ${text}`,
      res.status
    )
  }

  const data: ZoomTokenResponse = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  }

  return data.access_token
}

/**
 * Zoom APIへのリクエストを送信する（リトライ付き）
 */
async function zoomRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  attempt = 1
): Promise<T> {
  const maxRetries = 3
  const token = await getAccessToken()
  const baseUrl = 'https://api.zoom.us/v2'
  const url = `${baseUrl}${path}`

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    // 204 No Content
    if (res.status === 204) {
      return {} as T
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({
        code: 0,
        message: `HTTP ${res.status}: ${res.statusText}`,
      }))
      throw new ZoomApiError(
        String(errorBody.code || 'UNKNOWN'),
        errorBody.message || `HTTP ${res.status}`,
        res.status
      )
    }

    return (await res.json()) as T
  } catch (err) {
    if (err instanceof ZoomApiError) {
      // 429 Rate Limit or 5xx: retry
      if (attempt < maxRetries && (err.statusCode === 429 || err.statusCode >= 500)) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10_000)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return zoomRequest<T>(method, path, body, attempt + 1)
      }
      throw err
    }
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10_000)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return zoomRequest<T>(method, path, body, attempt + 1)
    }
    throw new ZoomApiError(
      'NETWORK_ERROR',
      err instanceof Error ? err.message : 'ネットワークエラーが発生しました',
      0
    )
  }
}

// ============================================================
// User Management Functions
// ============================================================

/**
 * Zoomユーザー一覧を取得する
 */
export async function listUsers(
  pageSize = 30,
  pageNumber = 1,
  status: 'active' | 'inactive' | 'pending' = 'active'
): Promise<ZoomListUsersResponse> {
  return zoomRequest<ZoomListUsersResponse>(
    'GET',
    `/users?page_size=${pageSize}&page_number=${pageNumber}&status=${status}`
  )
}

/**
 * Zoomユーザー詳細を取得する
 */
export async function getUser(userId: string): Promise<ZoomUser> {
  return zoomRequest<ZoomUser>('GET', `/users/${encodeURIComponent(userId)}`)
}

/**
 * Zoomユーザーを作成する
 */
export async function createUser(params: CreateZoomUserParams): Promise<ZoomUser> {
  return zoomRequest<ZoomUser>('POST', '/users', {
    action: 'create',
    user_info: {
      email: params.email,
      first_name: params.first_name,
      last_name: params.last_name,
      type: params.type ?? 1,
    },
  })
}

/**
 * Zoomユーザーを無効化する
 */
export async function deactivateUser(userId: string): Promise<void> {
  await zoomRequest<Record<string, never>>(
    'PUT',
    `/users/${encodeURIComponent(userId)}/status`,
    { action: 'deactivate' }
  )
}

/**
 * Zoomユーザーを削除する
 */
export async function deleteUser(userId: string): Promise<void> {
  await zoomRequest<Record<string, never>>(
    'DELETE',
    `/users/${encodeURIComponent(userId)}`
  )
}

/**
 * Zoomユーザーのステータスを変更する
 */
export async function updateUserStatus(
  userId: string,
  action: 'activate' | 'deactivate'
): Promise<void> {
  await zoomRequest<Record<string, never>>(
    'PUT',
    `/users/${encodeURIComponent(userId)}/status`,
    { action }
  )
}

// ============================================================
// Error Class
// ============================================================

export class ZoomApiError extends Error {
  code: string
  statusCode: number

  constructor(code: string, message: string, statusCode: number) {
    super(message)
    this.name = 'ZoomApiError'
    this.code = code
    this.statusCode = statusCode
  }
}
