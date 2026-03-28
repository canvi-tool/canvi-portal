import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const DEMO_ESTIMATE = {
  id: 'est-001',
  project_id: 'proj-001',
  estimate_number: 'EST-2026-001',
  title: 'Webサイトリニューアル見積書',
  client_name: '株式会社サンプルテック',
  client_address: '東京都渋谷区神宮前1-2-3',
  client_contact_person: '田中太郎',
  client_email: 'tanaka@sampletech.co.jp',
  description: 'コーポレートサイトのリニューアルに伴うデザイン・開発費用',
  items: [
    { name: 'UIデザイン', description: 'トップページ+下層5ページ', quantity: 1, unit: '式', unit_price: 500000, amount: 500000 },
    { name: 'フロントエンド開発', description: 'Next.js実装', quantity: 1, unit: '式', unit_price: 800000, amount: 800000 },
    { name: 'バックエンド開発', description: 'API開発・CMS構築', quantity: 1, unit: '式', unit_price: 600000, amount: 600000 },
    { name: 'テスト・検証', description: '結合テスト・ブラウザテスト', quantity: 1, unit: '式', unit_price: 200000, amount: 200000 },
  ],
  subtotal: 2100000,
  tax_rate: 10,
  tax_amount: 210000,
  total_amount: 2310000,
  valid_until: '2026-04-30',
  notes: '本見積書の有効期限は発行日より30日間です。',
  status: 'sent',
  created_by: 'user-001',
  created_at: '2026-03-01T09:00:00Z',
  updated_at: '2026-03-01T09:00:00Z',
}

interface RouteParams {
  params: Promise<{ id: string; estimateId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { estimateId } = await params

    if (DEMO_MODE) {
      return NextResponse.json({ ...DEMO_ESTIMATE, id: estimateId })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('project_estimates')
      .select('*')
      .eq('id', estimateId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '見積書が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET estimate error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { estimateId } = await params
    const body = await request.json()

    if (DEMO_MODE) {
      return NextResponse.json({
        ...DEMO_ESTIMATE,
        id: estimateId,
        ...body,
        updated_at: new Date().toISOString(),
      })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('project_estimates')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', estimateId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PUT estimate error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { estimateId } = await params

    if (DEMO_MODE) {
      return NextResponse.json({ success: true })
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('project_estimates')
      .delete()
      .eq('id', estimateId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE estimate error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
