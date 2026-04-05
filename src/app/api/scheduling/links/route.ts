import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 10; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  member_ids: z.array(z.string().uuid()).min(1),
  mode: z.enum(['all_free', 'any_free']),
  date_range_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_range_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_range_start: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  time_range_end: z.string().regex(/^\d{2}:\d{2}$/).default('18:00'),
  duration_minutes: z.number().int().min(15).max(480).default(60),
})

/**
 * POST /api/scheduling/links
 * 日程調整リンクを作成
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'バリデーションエラー', details: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    const slug = generateSlug()

    const admin = createAdminClient()
    const { data: link, error } = await admin
      .from('scheduling_links')
      .insert({
        slug,
        title: data.title,
        created_by: user.id,
        member_ids: data.member_ids,
        mode: data.mode,
        date_range_start: data.date_range_start,
        date_range_end: data.date_range_end,
        time_range_start: data.time_range_start,
        time_range_end: data.time_range_end,
        duration_minutes: data.duration_minutes,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30日後
      })
      .select()
      .single()

    if (error) {
      console.error('Create scheduling link error:', error)
      return NextResponse.json({ error: 'リンクの作成に失敗しました' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''
    const url = `${baseUrl}/schedule/${slug}`

    return NextResponse.json({ success: true, link, url, slug })
  } catch (error) {
    console.error('POST /api/scheduling/links error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

/**
 * GET /api/scheduling/links
 * 自分が作成したリンク一覧
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: links, error } = await admin
      .from('scheduling_links')
      .select('*, scheduling_bookings(*)')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('List scheduling links error:', error)
      return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ data: links })
  } catch (error) {
    console.error('GET /api/scheduling/links error:', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
