import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

/**
 * 次に利用可能なクライアントコード（CLT-000〜CLT-999）を取得する。
 * 既存コードの中から最も若い空き番号を返す。
 */
export async function generateNextClientCode(
  supabase: SupabaseClient<Database>
): Promise<string> {
  const { data, error } = await supabase
    .from('clients')
    .select('client_code')
    .like('client_code', 'CLT-%')
    .is('deleted_at', null)
    .order('client_code', { ascending: true })

  if (error) {
    console.error('Failed to fetch client codes:', error)
    throw new Error('クライアントコードの生成に失敗しました')
  }

  const usedNumbers = new Set<number>()
  for (const row of data || []) {
    const match = row.client_code?.match(/^CLT-(\d{3})$/)
    if (match) {
      usedNumbers.add(parseInt(match[1], 10))
    }
  }

  for (let i = 0; i <= 999; i++) {
    if (!usedNumbers.has(i)) {
      return `CLT-${String(i).padStart(3, '0')}`
    }
  }

  throw new Error('利用可能なクライアントコード（CLT-000〜CLT-999）がありません')
}
