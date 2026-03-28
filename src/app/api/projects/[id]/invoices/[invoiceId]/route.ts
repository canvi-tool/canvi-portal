import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const DEMO_INVOICE = {
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
}

interface RouteParams {
  params: Promise<{ id: string; invoiceId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { invoiceId } = await params

    if (DEMO_MODE) {
      return NextResponse.json({ ...DEMO_INVOICE, id: invoiceId })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('project_invoices')
      .select('*, contract:project_contracts(*)')
      .eq('id', invoiceId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '請求書が見つかりません' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET invoice error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { invoiceId } = await params
    const body = await request.json()

    if (DEMO_MODE) {
      return NextResponse.json({
        ...DEMO_INVOICE,
        id: invoiceId,
        ...body,
        updated_at: new Date().toISOString(),
      })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('project_invoices')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .select('*, contract:project_contracts(*)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PUT invoice error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { invoiceId } = await params

    if (DEMO_MODE) {
      return NextResponse.json({ success: true })
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('project_invoices')
      .delete()
      .eq('id', invoiceId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE invoice error:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
