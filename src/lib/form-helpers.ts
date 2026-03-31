/**
 * フォーム入力制御ヘルパー
 * 口座番号・口座名義・郵便番号・電話番号のフォーマットと制限
 */

// ====== 口座番号 ======
/** 半角数字のみ、最大7桁 */
export function formatBankAccountNumber(value: string): string {
  return value.replace(/[^\d]/g, '').slice(0, 7)
}

/** 口座番号バリデーション（7桁の半角数字） */
export function validateBankAccountNumber(value: string): string | null {
  if (!value) return null
  if (!/^\d{7}$/.test(value)) return '口座番号は半角数字7桁で入力してください'
  return null
}

// ====== 口座名義 ======
/**
 * 口座名義: 入力中はひらがな・カタカナ両方許可（IME対応）
 * 半角カナ・半角括弧は即時変換
 */
export function formatBankAccountHolder(value: string): string {
  // 半角カナ→全角カナ変換
  let v = halfToFullKatakana(value)
  // 半角括弧→全角括弧
  v = v.replace(/\(/g, '（').replace(/\)/g, '）')
  // ひらがな + カタカナ + 括弧 + スペース + 長音を許可（IME入力中のひらがなを残す）
  return v.replace(/[^\u3041-\u3096\u30A0-\u30FF（）\u3000 ー]/g, '')
}

/**
 * 口座名義: blur時にひらがな→カタカナに確定変換
 */
export function normalizeBankAccountHolder(value: string): string {
  return hiraganaToKatakana(value)
}

/** 口座名義バリデーション */
export function validateBankAccountHolder(value: string): string | null {
  if (!value) return null
  if (!/^[\u30A0-\u30FFー（）\u3000 ]+$/.test(value)) {
    return '口座名義はカタカナと（）で入力してください'
  }
  return null
}

// ====== 郵便番号 ======
/** 数字のみ抽出して XXX-XXXX 形式に自動整形 */
export function formatPostalCode(value: string): string {
  const digits = value.replace(/[^\d]/g, '').slice(0, 7)
  if (digits.length > 3) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }
  return digits
}

/** 郵便番号バリデーション */
export function validatePostalCode(value: string): string | null {
  if (!value) return null
  if (!/^\d{3}-\d{4}$/.test(value)) return '郵便番号は000-0000の形式で入力してください'
  return null
}

// ====== 電話番号 ======
/** 数字のみ抽出して電話番号形式に自動整形 */
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/[^\d]/g, '').slice(0, 11)

  // 携帯 (090/080/070/050): 3-4-4
  if (/^(090|080|070|050)/.test(digits)) {
    if (digits.length > 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    }
    if (digits.length > 3) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`
    }
    return digits
  }

  // 固定電話: 市外局番の桁数で判定
  // 0X-XXXX-XXXX (東京03, 大阪06 等) or 0XX-XXX-XXXX or 0XXX-XX-XXXX
  // 簡易的に: 先頭が0で2桁目が1-9 → 2桁市外局番
  if (/^0[1-9]/.test(digits)) {
    // 03, 06 等の2桁市外局番
    if (/^0[1-9][^0]/.test(digits) && digits.length <= 10) {
      if (digits.length > 6) {
        return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
      }
      if (digits.length > 2) {
        return `${digits.slice(0, 2)}-${digits.slice(2)}`
      }
    }
    // 3桁市外局番 (0XX)
    if (digits.length > 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    }
    if (digits.length > 3) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`
    }
  }

  return digits
}

/** 電話番号バリデーション */
export function validatePhoneNumber(value: string): string | null {
  if (!value) return null
  const digits = value.replace(/[^\d]/g, '')
  if (digits.length < 10 || digits.length > 11) {
    return '電話番号は10〜11桁の数字で入力してください'
  }
  if (!/^\d{2,4}-\d{2,4}-\d{3,4}$/.test(value)) {
    return '電話番号の形式が正しくありません'
  }
  return null
}

// ====== 郵便番号→住所自動入力 ======
interface PostalResult {
  prefecture: string
  city: string
  address: string
}

/** 郵便番号APIから住所を取得（zipcloud） */
export async function fetchAddressFromPostalCode(postalCode: string): Promise<PostalResult | null> {
  const digits = postalCode.replace(/-/g, '')
  if (digits.length !== 7) return null

  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`)
    const data = await res.json()
    if (data.status === 200 && data.results && data.results.length > 0) {
      const result = data.results[0]
      return {
        prefecture: result.address1 || '',
        city: result.address2 || '',
        address: result.address3 || '',
      }
    }
  } catch {
    // API error - silently fail
  }
  return null
}

// ====== ユーティリティ ======
/** ひらがな→カタカナ変換 */
function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  )
}

/** 半角カタカナ→全角カタカナ変換 */
function halfToFullKatakana(str: string): string {
  const map: Record<string, string> = {
    'ｦ': 'ヲ', 'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
    'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ', 'ｰ': 'ー',
    'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
    'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
    'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
    'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
    'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
    'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
    'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
    'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
    'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
    'ﾜ': 'ワ', 'ﾝ': 'ン', 'ﾞ': '゛', 'ﾟ': '゜',
  }
  return str.replace(/[ｦ-ﾟ]/g, (ch) => map[ch] || ch)
}
