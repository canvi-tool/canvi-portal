/**
 * freee Sign API クライアント
 *
 * freee Sign（電子署名サービス）との連携を提供します。
 * 環境変数で API URL・認証情報を設定してください。
 *
 * 必要な環境変数:
 *   FREEE_SIGN_API_URL - APIベースURL (例: https://api.freee-sign.com/v1)
 *   FREEE_SIGN_API_KEY - APIキー
 *   FREEE_SIGN_COMPANY_ID - 会社ID
 */

interface FreeeSignConfig {
  apiUrl: string
  apiKey: string
  companyId: string
}

interface FreeeSignDocumentRequest {
  title: string
  signerName: string
  signerEmail: string
  pdfUrl?: string
  pdfBase64?: string
  message?: string
  callbackUrl?: string
}

interface FreeeSignDocument {
  id: string
  title: string
  status: 'created' | 'sent' | 'viewed' | 'signed' | 'rejected' | 'expired'
  signerName: string
  signerEmail: string
  createdAt: string
  updatedAt: string
  signedAt: string | null
  downloadUrl: string | null
}

interface FreeeSignListResponse {
  documents: FreeeSignDocument[]
  total: number
  page: number
  perPage: number
}

interface FreeeSignError {
  code: string
  message: string
  details?: Record<string, string>
}

function getConfig(): FreeeSignConfig {
  const apiUrl = process.env.FREEE_SIGN_API_URL || 'https://api.freee-sign.com/v1'
  const apiKey = process.env.FREEE_SIGN_API_KEY || ''
  const companyId = process.env.FREEE_SIGN_COMPANY_ID || ''
  return { apiUrl, apiKey, companyId }
}

export class FreeeSignClient {
  private config: FreeeSignConfig
  private maxRetries: number

  constructor(config?: Partial<FreeeSignConfig>, maxRetries = 3) {
    const defaultConfig = getConfig()
    this.config = { ...defaultConfig, ...config }
    this.maxRetries = maxRetries
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
      'X-Company-Id': this.config.companyId,
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    attempt = 1
  ): Promise<T> {
    const url = `${this.config.apiUrl}${path}`

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

      return (await res.json()) as T
    } catch (err) {
      if (err instanceof FreeeSignApiError) {
        // Retry on 429 (rate limit) or 5xx server errors
        if (attempt < this.maxRetries && (err.statusCode === 429 || err.statusCode >= 500)) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          await new Promise((resolve) => setTimeout(resolve, delay))
          return this.request<T>(method, path, body, attempt + 1)
        }
        throw err
      }
      // Network errors - retry
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

  /**
   * 署名依頼ドキュメントを送信する
   */
  async sendDocument(data: FreeeSignDocumentRequest): Promise<FreeeSignDocument> {
    return this.request<FreeeSignDocument>('POST', '/documents', {
      title: data.title,
      signer_name: data.signerName,
      signer_email: data.signerEmail,
      pdf_url: data.pdfUrl,
      pdf_base64: data.pdfBase64,
      message: data.message || '',
      callback_url: data.callbackUrl || '',
    })
  }

  /**
   * ドキュメントのステータスを取得する
   */
  async getDocumentStatus(documentId: string): Promise<FreeeSignDocument> {
    return this.request<FreeeSignDocument>('GET', `/documents/${documentId}`)
  }

  /**
   * ドキュメント一覧を取得する
   */
  async listDocuments(
    page = 1,
    perPage = 20
  ): Promise<FreeeSignListResponse> {
    return this.request<FreeeSignListResponse>(
      'GET',
      `/documents?page=${page}&per_page=${perPage}`
    )
  }

  /**
   * 署名済みドキュメントのPDFをダウンロードする
   */
  async downloadSignedDocument(documentId: string): Promise<ArrayBuffer> {
    const url = `${this.config.apiUrl}/documents/${documentId}/download`
    const res = await fetch(url, {
      method: 'GET',
      headers: this.headers,
    })
    if (!res.ok) {
      throw new FreeeSignApiError(
        'DOWNLOAD_ERROR',
        `ドキュメントのダウンロードに失敗しました (HTTP ${res.status})`,
        res.status
      )
    }
    return res.arrayBuffer()
  }

  /**
   * ドキュメントの署名依頼をキャンセルする
   */
  async cancelDocument(documentId: string): Promise<FreeeSignDocument> {
    return this.request<FreeeSignDocument>(
      'POST',
      `/documents/${documentId}/cancel`
    )
  }
}

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

// Singleton instance for convenience
let _client: FreeeSignClient | null = null

export function getFreeeSignClient(): FreeeSignClient {
  if (!_client) {
    _client = new FreeeSignClient()
  }
  return _client
}
