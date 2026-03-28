import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const DEMO_INVOICES = [
  {
    id: 'inv-001',
    project_id: 'proj-001',
    contract_id: 'pc-001',
    invoice_number: 'INV-2026-001',
    title: 'Webサイトリニューアル 第1回請求書',
    client_name: '株式会社サンプルテック',
    client_address: '東京都渋谷区神宮前1-2-3',
    client_contact_person: '田中太郎',
    client_email: 'tanaka@sampletech.co.jp',
    description: 'デザイン・フロントエンド開発（中間納品分）',
    items: [
      { name: 'UIデザイン', description: 'トップページ+下層5ページ', quantity: 1, unit: '式', unit_price: 500000, amount: 500000 },
      { name: 'フロントエンド開発', description: 'Next.js実装（50%完了）', quantity: 1, unit: '式', unit_price: 400000, amount: 400000 },
    ],
    subtotal: 900000,
    tax_rate: 10,
    tax_amount: 90000,
    total_amount: 990000,
    issue_date: '2026-04-30',
    due_date: '2026-05-31',
    payment_method: '銀行振込',
    bank_info: '三菱UFJ銀行 渋谷支店 普通 1234567 カ）キャンヴィ',
    notes: 'お振込手数料はお客様負担でお願いいたします。',
    status: 'sent',
    sent_at: '2026-04-30T10:00:00Z',
    paid_at: null,
    created_by: 'user-001',
    created_at: '2026-04-28T09:00:00Z',
    updated_at: '2026-04-30T10:00:00Z',
  },
  {
    id: 'inv-002',
    project_id: 'proj-001',
    contract_id: 'pc-001',
    invoice_number: 'INV-2026-002',
    title: 'Webサイトリニューアル 最終請求書',
    client_name: '株式会社サンプルテック',
    client_address: '東京都渋谷区神宮前1-2-3',
    client_contact_person: '田中太郎',
    client_email: 'tanaka@sampletech.co.jp',
    description: 'バックエンド開発・テスト・最終納品分',
    items: [
      { name: 'フロントエンド開発', description: 'Next.js実装（残り50%）', quantity: 1, unit: '式', unit_price: 400000, amount: 400000 },
      { name: 'バックエンド開発', description: 'API開発・CMS構築', quantity: 1, unit: '式', unit_price: 600000, amount: 600000 },
      { name: 'テスト・検証', description: '結合テスト・ブラウザテスト', quantity: 1, unit: '式', unit_price: 200000, amount: 200000 },
    ],
    subtotal: 1200000,
    tax_rate: 10,
    tax_amount: 120000,
    total_amount: 1320000,
    issue_date: '2026-06-30',
    due_date: '2026-07-31',
    payment_method: '銀行振込',
    bank_info: '三菱UFJ銀行 渋谷支店 普通 1234567 カ）キャンヴィ',
    notes: null,
    status: 'draft',
    sent_at: null,
    paid_at: null,
    created_by: 'user-001',
    created_at: '2026-06-25T09:00:00Z',
    updated_at: '2026-06-25T09:00:00Z',
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
      let data = DEMO_INVOICES.filter((i) => i.project_id === projectId || projectId === 'proj-001')
      if (status) {
        data = data.filter((i) => i.status === status)
      }
      return NextResponse.json({ data, total: data.length })
    }

    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('project_invoices')
      .select('*, contract:project_contracts(*)', { count: 'exact' })
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled')
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [], total: count || 0 })
  } catch (error) {
    console.error('GET /api/projects/[id]/invoices error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params
    const body = await request.json()

    if (DEMO_MODE) {
      const newInvoice = {
        id: `inv-${Date.now()}`,
        project_id: projectId,
        sent_at: null,
        paid_at: null,
        ...body,
        status: body.status || 'draft',
        issue_date: body.issue_date || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      return NextResponse.json(newInvoice, { status: 201 })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('project_invoices')
      .insert({
        project_id: projectId,
        contract_id: body.contract_id || null,
        invoice_number: body.invoice_number,
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
        issue_date: body.issue_date || new Date().toISOString().split('T')[0],
        due_date: body.due_date || null,
        payment_method: body.payment_method || null,
        bank_info: body.bank_info || null,
        notes: body.notes || null,
        status: body.status || 'draft',
        created_by: body.created_by || null,
      })
      .select('*, contract:project_contracts(*)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects/[id]/invoices error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
