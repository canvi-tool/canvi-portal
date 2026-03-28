import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const DEMO_ESTIMATES = [
  {
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
  },
  {
    id: 'est-002',
    project_id: 'proj-001',
    estimate_number: 'EST-2026-002',
    title: '追加機能開発見積書',
    client_name: '株式会社サンプルテック',
    client_address: '東京都渋谷区神宮前1-2-3',
    client_contact_person: '田中太郎',
    client_email: 'tanaka@sampletech.co.jp',
    description: 'お問い合わせフォーム・FAQ機能の追加開発',
    items: [
      { name: 'お問い合わせフォーム', description: 'フォーム設計・実装・メール通知', quantity: 1, unit: '式', unit_price: 300000, amount: 300000 },
      { name: 'FAQページ', description: 'FAQ管理機能付き', quantity: 1, unit: '式', unit_price: 250000, amount: 250000 },
    ],
    subtotal: 550000,
    tax_rate: 10,
    tax_amount: 55000,
    total_amount: 605000,
    valid_until: '2026-05-15',
    notes: null,
    status: 'draft',
    created_by: 'user-001',
    created_at: '2026-03-15T10:00:00Z',
    updated_at: '2026-03-15T10:00:00Z',
  },
]

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    if (DEMO_MODE) {
      let data = DEMO_ESTIMATES.filter((e) => e.project_id === projectId || projectId === 'proj-001')
      if (status) {
        data = data.filter((e) => e.status === status)
      }
      return NextResponse.json({ data, total: data.length })
    }

    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('project_estimates')
      .select('*', { count: 'exact' })
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status as 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired')
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('GET /api/projects/[id]/estimates error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params
    const body = await request.json()

    if (DEMO_MODE) {
      const newEstimate = {
        id: `est-${Date.now()}`,
        project_id: projectId,
        ...body,
        status: body.status || 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      return NextResponse.json(newEstimate, { status: 201 })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('project_estimates')
      .insert({
        project_id: projectId,
        estimate_number: body.estimate_number,
        title: body.title,
        client_name: body.client_name,
        client_address: body.client_address || null,
        client_contact_person: body.client_contact_person || null,
        client_email: body.client_email || null,
        description: body.description || null,
        items: body.items || [],
        subtotal: body.subtotal || 0,
        tax_rate: body.tax_rate ?? 10,
        tax_amount: body.tax_amount || 0,
        total_amount: body.total_amount || 0,
        valid_until: body.valid_until || null,
        notes: body.notes || null,
        status: body.status || 'draft',
        created_by: body.created_by || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects/[id]/estimates error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
