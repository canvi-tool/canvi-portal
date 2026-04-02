import crypto from 'crypto'

/**
 * セキュアなランダムパスワードを生成
 * 要件: 12文字以上、大文字・小文字・数字・記号を含む
 */
export function generateSecurePassword(length: number = 14): string {
  const uppercase = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const lowercase = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%&*'
  const allChars = uppercase + lowercase + digits + symbols

  // 各カテゴリから最低1文字を確保
  let password = ''
  password += uppercase[crypto.randomInt(uppercase.length)]
  password += lowercase[crypto.randomInt(lowercase.length)]
  password += digits[crypto.randomInt(digits.length)]
  password += symbols[crypto.randomInt(symbols.length)]

  // 残りをランダムに埋める
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)]
  }

  // シャッフル（Fisher-Yates）
  const arr = password.split('')
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  return arr.join('')
}

/**
 * 機密データをマスクする（監査ログ用）
 * 例: "1234567" → "***4567"
 */
export function maskSensitiveField(value: string | null | undefined, visibleChars: number = 4): string {
  if (!value) return '***'
  if (value.length <= visibleChars) return '***'
  return '***' + value.slice(-visibleChars)
}

/**
 * 銀行口座番号をマスクする
 * 例: "7578542" → "***8542"
 */
export function maskBankAccountNumber(value: string | null | undefined): string {
  return maskSensitiveField(value, 4)
}

/**
 * 電話番号をマスクする
 * 例: "080-3241-1407" → "***-****-1407"
 */
export function maskPhoneNumber(value: string | null | undefined): string {
  if (!value) return '***'
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 4) return '***'
  return '***-****-' + digits.slice(-4)
}
