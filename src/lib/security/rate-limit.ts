/**
 * シンプルなインメモリレート制限
 * Vercel Serverless環境では同一インスタンス内でのみ有効
 * 本番環境ではUpstash Redis等の外部ストアへの移行を推奨
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// 定期的に期限切れエントリをクリーンアップ
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key)
    }
  }
}, 60_000) // 1分ごと

interface RateLimitConfig {
  /** 制限あたりのリクエスト数 */
  limit: number
  /** ウィンドウ期間（秒） */
  windowSeconds: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * レート制限チェック
 * @param key 識別キー（IPアドレスやユーザーID等）
 * @param config レート制限設定
 * @returns 成功/失敗とリマイニング情報
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  // 新規または期限切れ
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowSeconds * 1000
    store.set(key, { count: 1, resetAt })
    return { success: true, remaining: config.limit - 1, resetAt }
  }

  // カウント増加
  entry.count++

  if (entry.count > config.limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { success: true, remaining: config.limit - entry.count, resetAt: entry.resetAt }
}

/**
 * APIルート用のレート制限プリセット
 */
export const RATE_LIMITS = {
  // 認証系: 1分あたり10回
  auth: { limit: 10, windowSeconds: 60 },
  // トークン検証: 1分あたり5回（ブルートフォース防止）
  tokenValidation: { limit: 5, windowSeconds: 60 },
  // 一般API: 1分あたり60回
  api: { limit: 60, windowSeconds: 60 },
  // 書き込み系: 1分あたり20回
  write: { limit: 20, windowSeconds: 60 },
  // ファイルアップロード: 1分あたり5回
  upload: { limit: 5, windowSeconds: 60 },
  // 機密データアクセス: 1分あたり10回
  sensitiveData: { limit: 10, windowSeconds: 60 },
} as const

/**
 * リクエストからIPアドレスを取得
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}
