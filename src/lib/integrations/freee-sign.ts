/**
 * freee Sign (ninja-sign.com) API クライアント
 *
 * OAuth 2.0認証フローを使用してfreee Signと連携します。
 * Swagger UI: https://ninja-sign.com/v1/docs
 *
 * 必要な環境変数:
 *   FREEE_SIGN_CLIENT_ID     - OAuth クライアントID
 *   FREEE_SIGN_CLIENT_SECRET - OAuth クライアントシークレット
 *   FREEE_SIGN_REDIRECT_URI  - OAuthリダイレクトURI
 *   FREEE_SIGN_WEBHOOK_SECRET - Webhook署名検証用シークレット
 *
 * レート制限: 同一IPから5リクエスト/秒（429で返却）
 */

import { createHmac } from 'crypto'

// ─── 型定義 ──────────────────────────────────────────

interface FreeeSignOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

interface FreeeSignTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope?: string
}

export interface FreeeSignDocument {
  id: string
  title: string
  status: 'creating' | 'created' | 'sent' | 'viewed' | 'signed' | 'completed' | 'rejected' | 'expired' | 'cancelled'
  owner_id: string
  folder_id: string | null
  created_at: string
  updated_at: string
}

interface FreeeSignDocumentCreateRequest {
  title: string
  template_id?: string
  folder_id?: string
}

export interface FreeeSignConfirmationRequest {
  document_id: string
  sender_user_id: string
  recipients: {
    email: string
    name: string
    message?: string
  }[]
}

interface FreeeSignTemplate {
  id: string
  name: string
  description?: string
}

interface FreeeSignInputField {
  id: string
  key: string
  value: string | null
  type: string
}

export interface FreeeSignWebhookPayload {
  trigger: 'document_status_changed' | 'post_test'
  document?: {
    id: string
    title: string
    owner_id: string
    status: string
    folder_id: string | null
    created_at: string
    updated_at: string
  }
  message?: string
}

interface FreeeSignError {
  code: string
  message: string
  details?: Record<string, string>
}

// ─── OAuth 2.0 ──────────────────────────────────────

function getOAuthConfig(): FreeeSignOAuthConfig {
  return {
    clientId: process.env.FREEE_SIGN_CLIENT_ID || '',
    clientSecret: process.env.FREEE_SIGN_CLIENT_SECRET || '',
    redirectUri: process.env.FREEE_SIGN_REDIRECT_URI || '',
  }
}

const API_BASE = 'https://ninja-sign.com'
const API_V1 = `${API_BASE}/v1`

/**
 * OAuth認可URLを生成する
 */
export function getFreeeSignAuthUrl(state: string): string {
  const config = getOAuthConfig()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
  })
  return `${API_BASE}/oauth/authorize?${params.toString()}`
}

/**
 * 認可コードをアクセストークンに交換する
 */
export async function exchangeCodeForToken(code: string): Promise<FreeeSignTokenResponse> {
  const config = getOAuthConfig()
  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Token exchange failed' }))
    throw new FreeeSignApiError('AUTH_ERROR', err.message || 'トークン交換に失敗しました', res.status)
  }
  return res.json()
}

/**
 * リフレッシュトークンでアクセストークンを更新する
 */
export async function refreshAccessToken(refreshToken: string): Promise<FreeeSignTokenResponse> {
  const config = getOAuthConfig()
  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Token refresh failed' }))
    throw new FreeeSignApiError('AUTH_ERROR', err.message || 'トークン更新に失敗しました', res.status)
  }
  return res.json()
}

// ─── Webhook署名検証 ────────────────────────────────

/**
 * Webhookリクエストの署名を検証する (HMAC-SHA256)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret?: string
): boolean {
  const webhookSecret = secret || process.env.FREEE_SIGN_WEBHOOK_SECRET || ''
  if (!webhookSecret || !signature) return false

  const expectedSig = signature.replace('sha256=', '')
  const computed = createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex')

  return computed === expectedSig
}

// ─── APIクライアント ────────────────────────────────

export class FreeeSignClient {
  private accessToken: string
  private maxRetries: number

  constructor(accessToken: string, maxRetries = 3) {
    this.accessToken = accessToken
    this.maxRetries = maxRetries
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.accessToken}`,
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    attempt = 1
  ): Promise<T> {
    const url = `${API_V1}${path}`

    try {
      const res = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
      })

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({
          code: 'UNKNOWN',
          message: `HTTP ${res.status}: ${res.statusText}`,
        }))
        const error = errorBody as FreeeSignError
        throw new FreeeSignApiError(error.code, error.message, res.status, error.details)
      }

      const text = await res.text()
      return text ? JSON.parse(text) as T : {} as T
    } catch (err) {
      if (err instanceof FreeeSignApiError) {
        if (attempt < this.maxRetries && (err.statusCode === 429 || err.statusCode >= 500)) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          await new Promise((resolve) => setTimeout(resolve, delay))
          return this.request<T>(method, path, body, attempt + 1)
        }
        throw err
      }
      if (attempt < this.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.request<T>(method, path, body, attempt + 1)
      }
      throw new FreeeSignApiError(
        'NETWORK_ERROR',
        err instanceof Error ? err.message : 'ネットワークエラーが発生しました',
        0
      )
    }
  }

  // ─── テンプレート ───────────────────────────────

  /** テンプレート一覧を取得 */
  async listTemplates(): Promise<FreeeSignTemplate[]> {
    return this.request<FreeeSignTemplate[]>('GET', '/templates')
  }

  /** テンプレート詳細を取得 */
  async getTemplate(templateId: string): Promise<FreeeSignTemplate> {
    return this.request<FreeeSignTemplate>('GET', `/templates/${templateId}`)
  }

  // ─── ドキュメント ───────────────────────────────

  /** テンプレートからドキュメントを作成 */
  async createDocument(data: FreeeSignDocumentCreateRequest): Promise<FreeeSignDocument> {
    return this.request<FreeeSignDocument>('POST', '/documents', data)
  }

  /** ファイルアップロードでドキュメントを作成 */
  async uploadDocument(title: string, pdfBase64: string): Promise<FreeeSignDocument> {
    return this.request<FreeeSignDocument>('POST', '/documents/upload', {
      title,
      file: pdfBase64,
    })
  }

  /** ドキュメント取得 */
  async getDocument(documentId: string): Promise<FreeeSignDocument> {
    return this.request<FreeeSignDocument>('GET', `/documents/${documentId}`)
  }

  /** ドキュメント一覧 */
  async listDocuments(page = 1, perPage = 20): Promise<{ documents: FreeeSignDocument[]; total: number }> {
    return this.request('GET', `/documents?page=${page}&per_page=${perPage}`)
  }

  /** ドキュメント削除 */
  async deleteDocument(documentId: string): Promise<void> {
    await this.request('DELETE', `/documents/${documentId}`)
  }

  // ─── 入力フィールド ─────────────────────────────

  /** 入力フィールド一覧を取得 */
  async getInputFields(documentId: string): Promise<FreeeSignInputField[]> {
    return this.request<FreeeSignInputField[]>('GET', `/documents/${documentId}/input_fields`)
  }

  /** 入力フィールドに値を設定 */
  async setInputFieldValues(
    documentId: string,
    fields: { id: string; value: string }[]
  ): Promise<void> {
    await this.request('PUT', `/documents/${documentId}/input_fields`, { fields })
  }

  // ─── 署名送信 ───────────────────────────────────

  /** ドキュメントを署名者に送信 */
  async sendForSignature(data: FreeeSignConfirmationRequest): Promise<FreeeSignDocument> {
    return this.request<FreeeSignDocument>(
      'POST',
      `/documents/${data.document_id}/confirmations`,
      {
        sender_user_id: data.sender_user_id,
        recipients: data.recipients,
      }
    )
  }

  /** ドキュメントのキャンセル */
  async cancelDocument(documentId: string): Promise<FreeeSignDocument> {
    return this.request<FreeeSignDocument>('POST', `/documents/${documentId}/cancel`)
  }

  // ─── ダウンロード ───────────────────────────────

  /** 署名済みドキュメントをダウンロード */
  async downloadDocument(documentId: string): Promise<ArrayBuffer> {
    const url = `${API_V1}/documents/${documentId}/download`
    const res = await fetch(url, { method: 'GET', headers: this.headers })
    if (!res.ok) {
      throw new FreeeSignApiError(
        'DOWNLOAD_ERROR',
        `ドキュメントのダウンロードに失敗しました (HTTP ${res.status})`,
        res.status
      )
    }
    return res.arrayBuffer()
  }

  // ─── フォルダ ───────────────────────────────────

  /** フォルダ一覧を取得 */
  async listFolders(): Promise<{ id: string; name: string }[]> {
    return this.request('GET', '/folders')
  }
}

// ─── エラークラス ───────────────────────────────────

export class FreeeSignApiError extends Error {
  code: string
  statusCode: number
  details?: Record<string, string>

  constructor(
    code: string,
    message: string,
    statusCode: number,
    details?: Record<string, string>
  ) {
    super(message)
    this.name = 'FreeeSignApiError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

// ─── ユーティリティ ─────────────────────────────────

/**
 * freee Signステータスを契約ステータスにマッピング
 */
export function mapFreeeSignStatusToContractStatus(
  freeeStatus: string
): 'pending_signature' | 'signed' | 'draft' | null {
  switch (freeeStatus) {
    case 'sent':
    case 'viewed':
    case 'creating':
    case 'created':
      return 'pending_signature'
    case 'signed':
    case 'completed':
      return 'signed'
    case 'rejected':
    case 'cancelled':
    case 'expired':
      return 'draft'
    default:
      return null
  }
}
