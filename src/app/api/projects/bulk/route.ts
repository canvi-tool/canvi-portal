import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'

const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, '対象を1件以上選択してください').max(100),
  status: z.enum(['proposing', 'active', 'ended']).optional(),
  report_type: z.enum(['training', 'outbound', 'inbound', 'leon_is']).nullable().optional(),
  shift_approval_mode: z.enum(['AUTO', 'APPROVAL']).optional(),
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
    const { ids, status, report_type, shift_approval_mode } = bulkUpdateSchema.parse(body)

    // 更新対象フィールドを構築
    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (status !== undefined) {
      updateFields.status = STATUS_TO_DB[status] || status
    }
    if (report_type !== undefined) {
      updateFields.report_type = report_type
    }
    if (shift_approval_mode !== undefined) {
      updateFields.shift_approval_mode = shift_approval_mode
    }

    // status, report_type, shift_approval_mode のいずれも指定されていない場合エラー
    if (status === undefined && report_type === undefined && shift_approval_mode === undefined) {
      return NextResponse.json(
        { error: '更新するフィールドを1つ以上指定してください' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('projects')
      .update(updateFields)
      .in('id', ids)
      .select('id')

    if (error) {
      return NextResponse.json(
        { error: '一括更新に失敗しました: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      updated: data?.length ?? 0,
      fields: {
        ...(status !== undefined && { status }),
        ...(report_type !== undefined && { report_type }),
        ...(shift_approval_mode !== undefined && { shift_approval_mode }),
      },
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
