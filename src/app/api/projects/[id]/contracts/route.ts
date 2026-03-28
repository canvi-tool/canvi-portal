import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const DEMO_PROJECT_CONTRACTS = [
  {
    id: 'pc-001',
    project_id: 'proj-001',
    estimate_id: 'est-001',
    contract_number: 'PC-2026-001',
    title: 'Webサイトリニューアル業務委託契約書',
    client_name: '株式会社サンプルテック',
    client_address: '東京都渋谷区神宮前1-2-3',
    client_contact_person: '田中太郎',
    client_email: 'tanaka@sampletech.co.jp',
    content: '第1条（目的）\n本契約は、甲が乙に対してWebサイトリニューアル業務を委託し、乙がこれを受託することについて定めるものである。\n\n第2条（業務内容）\n乙は、甲のコーポレートサイトのリニューアルに関するデザイン・開発業務を行う。',
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
    start_date: '2026-04-01',
    end_date: '2026-06-30',
    payment_terms: '納品検収後30日以内に銀行振込にてお支払い',
    notes: null,
    status: 'active',
    external_sign_id: 'freee-sign-doc-001',
    signed_at: '2026-03-20T14:00:00Z',
    signed_document_url: null,
    created_by: 'user-001',
    created_at: '2026-03-05T10:00:00Z',
    updated_at: '2026-03-20T14:00:00Z',
  },
  {
    id: 'pc-002',
    project_id: 'proj-001',
    estimate_id: null,
    contract_number: 'PC-2026-002',
    title: '保守運用契約書',
    client_name: '株式会社サンプルテック',
    client_address: '東京都渋谷区神宮前1-2-3',
    client_contact_person: '田中太郎',
    client_email: 'tanaka@sampletech.co.jp',
    content: null,
    items: [
      { name: '月額保守費用', description: 'サーバー監視・セキュリティアップデート', quantity: 12, unit: '月', unit_price: 50000, amount: 600000 },
    ],
    subtotal: 600000,
    tax_rate: 10,
    tax_amount: 60000,
    total_amount: 660000,
    start_date: '2026-07-01',
    end_date: '2027-06-30',
    payment_terms: '毎月末日締め翌月末日払い',
    notes: '自動更新条項あり',
    status: 'draft',
    external_sign_id: null,
    signed_at: null,
    signed_document_url: null,
    created_by: 'user-001',
    created_at: '2026-03-25T11:00:00Z',
    updated_at: '2026-03-25T11:00:00Z',
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
      let data = DEMO_PROJECT_CONTRACTS.filter((c) => c.project_id === projectId || projectId === 'proj-001')
      if (status) {
        data = data.filter((c) => c.status === status)
      }
      return NextResponse.json({ data, total: data.length })
    }

    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('project_contracts')
      .select('*, estimate:project_estimates(*)', { count: 'exact' })
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status as 'draft' | 'pending_signature' | 'signed' | 'active' | 'expired' | 'terminated')
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('GET /api/projects/[id]/contracts error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params
    const body = await request.json()

    if (DEMO_MODE) {
      const newContract = {
        id: `pc-${Date.now()}`,
        project_id: projectId,
        external_sign_id: null,
        signed_at: null,
        signed_document_url: null,
        ...body,
        status: body.status || 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      return NextResponse.json(newContract, { status: 201 })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('project_contracts')
      .insert({
        project_id: projectId,
        estimate_id: body.estimate_id || null,
        contract_number: body.contract_number,
        title: body.title,
        client_name: body.client_name,
        client_address: body.client_address || null,
        client_contact_person: body.client_contact_person || null,
        client_email: body.client_email || null,
        content: body.content || null,
        items: body.items || [],
        subtotal: body.subtotal || 0,
        tax_rate: body.tax_rate ?? 10,
        tax_amount: body.tax_amount || 0,
        total_amount: body.total_amount || 0,
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        payment_terms: body.payment_terms || null,
        notes: body.notes || null,
        status: body.status || 'draft',
        created_by: body.created_by || null,
      })
      .select('*, estimate:project_estimates(*)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects/[id]/contracts error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
