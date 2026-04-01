import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'

const bulkStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, '対象を1件以上選択してください').max(100),
  status: z.enum(['active', 'inactive', 'retired']),
})

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { ids, status } = bulkStatusSchema.parse(body)

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('staff')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids)
      .select('id, email')

    if (error) {
      return NextResponse.json(
        { error: 'ステータスの一括更新に失敗しました: ' + error.message },
        { status: 500 }
      )
    }

    // 退職ステータスの場合、該当スタッフのポータルアカウントを無効化
    if (status === 'retired' && data && data.length > 0) {
      const adminClient = createAdminClient()
      const bannedEmails: string[] = []

      for (const staff of data) {
        if (!staff.email) continue
        try {
          const { data: portalUser } = await adminClient
            .from('users')
            .select('id')
            .eq('email', staff.email)
            .maybeSingle()

          if (portalUser) {
            await adminClient.auth.admin.updateUserById(portalUser.id, {
              ban_duration: '876600h',
            })
            bannedEmails.push(staff.email)
          }
        } catch (banErr) {
          console.error(`退職時アカウント無効化エラー (${staff.email}):`, banErr)
        }
      }

      if (bannedEmails.length > 0) {
        console.log(`一括退職処理: ${bannedEmails.join(', ')} のポータルアカウントを無効化しました`)
      }
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
