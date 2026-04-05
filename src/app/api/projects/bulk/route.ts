import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'

const bulkStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, '対象を1件以上選択してください').max(100),
  status: z.enum(['proposing', 'active', 'ended']),
})

// 新ステータス→旧DB enum値マッピング（マイグレーション前の互換対応）
const STATUS_TO_DB: Record<string, string> = {
  proposing: 'planning',
  active: 'active',
  ended: 'completed',
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { ids, status } = bulkStatusSchema.parse(body)
    const dbStatus = STATUS_TO_DB[status] || status

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('projects')
      .update({ status: dbStatus, updated_at: new Date().toISOString() })
      .in('id', ids)
      .select('id')

    if (error) {
      return NextResponse.json(
        { error: 'ステータスの一括更新に失敗しました: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      updated: data?.length ?? 0,
      status,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message || 'バリデーションエラー' },
        { status: 400 }
      )
    }
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'Forbidden') {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }
    return NextResponse.json(
      { error: '予期しないエラーが発生しました' },
      { status: 500 }
    )
  }
}
