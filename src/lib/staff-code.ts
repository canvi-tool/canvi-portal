import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

/**
 * 次に利用可能なスタッフコード（S0001〜S9999）を取得する。
 * 既存コードの中から最も若い空き番号を返す。
 */
export async function generateNextStaffCode(
  supabase: SupabaseClient<Database>
): Promise<string> {
  // S から始まるコードを全件取得（staff_code は S0001〜S9999 の範囲）
  const { data, error } = await supabase
    .from('staff')
    .select('staff_code')
    .like('staff_code', 'S%')
    .order('staff_code', { ascending: true })

  if (error) {
    console.error('Failed to fetch staff codes:', error)
    throw new Error('スタッフコードの生成に失敗しました')
  }

  // 使用済み番号をSetに格納
  const usedNumbers = new Set<number>()
  for (const row of data || []) {
    const match = row.staff_code?.match(/^S(\d{1,4})$/)
    if (match) {
      usedNumbers.add(parseInt(match[1], 10))
    }
  }

  // 1〜9999 の中で最初の空き番号を探す
  for (let i = 1; i <= 9999; i++) {
    if (!usedNumbers.has(i)) {
      return `S${String(i).padStart(4, '0')}`
    }
  }

  throw new Error('利用可能なスタッフコード（S0001〜S9999）がありません')
}
