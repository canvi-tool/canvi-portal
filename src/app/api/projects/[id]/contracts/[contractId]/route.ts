import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const DEMO_PROJECT_CONTRACT = {
  id: 'pc-001',
  project_id: 'proj-001',
  estimate_id: 'est-001',
  contract_number: 'PC-2026-001',
  title: 'Webサイトリニューアル業務委託契約書',
  client_name: '株式会社サンプルテック',
  client_address: '東京都渋谷区神宮前1-2-3',
  client_contact_person: '田中太郎',
  client_email: 'tanaka@sampletech.co.jp',
  content: '第1条（目的）\n本契約は、甲が乙に対してWebサイトリニューアル業務を委託し、乙がこれを受託することについて定めるものである。',
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
}

interface RouteParams {
  params: Promise<{ id: string; contractId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { contractId } = await params

    if (DEMO_MODE) {
      return NextResponse.json({ ...DEMO_PROJECT_CONTRACT, id: contractId })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('project_contracts')
      .select('*, estimate:project_estimates(*)')
      .eq('id', contractId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'PJ契約書が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET project contract error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { contractId } = await params
    const body = await request.json()

    if (DEMO_MODE) {
      return NextResponse.json({
        ...DEMO_PROJECT_CONTRACT,
        id: contractId,
        ...body,
        updated_at: new Date().toISOString(),
      })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('project_contracts')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractId)
      .select('*, estimate:project_estimates(*)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PUT project contract error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { contractId } = await params

    if (DEMO_MODE) {
      return NextResponse.json({ success: true })
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('project_contracts')
      .delete()
      .eq('id', contractId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE project contract error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
