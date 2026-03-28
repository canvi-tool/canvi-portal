import { NextRequest, NextResponse } from 'next/server'
import * as zoomPhone from '@/lib/integrations/zoom-phone'
import type { ZoomPhoneNumber } from '@/lib/integrations/zoom-phone'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// デモ用電話番号データ
const DEMO_PHONE_NUMBERS: ZoomPhoneNumber[] = [
  // ユーザー直通番号
  { id: 'pn-001', number: '03-5555-0101', display_name: '佐藤健太 直通', type: 'toll', assignee_type: 'user' },
  { id: 'pn-002', number: '03-5555-0102', display_name: '田中美咲 直通', type: 'toll', assignee_type: 'user' },
  { id: 'pn-003', number: '03-5555-0103', display_name: '鈴木一郎 直通', type: 'toll', assignee_type: 'user' },
  { id: 'pn-004', number: '03-5555-0104', display_name: '山田花子 直通', type: 'toll', assignee_type: 'user' },
  { id: 'pn-005', number: '03-5555-0105', display_name: '高橋雄太 直通', type: 'toll', assignee_type: 'user' },
  // コールキュー番号
  { id: 'pn-cq-001', number: '03-6789-0001', display_name: 'AIアポブースト代表', type: 'toll', assignee_type: 'callQueue' },
  { id: 'pn-cq-002', number: '03-6789-0002', display_name: 'WHITE営業代行', type: 'toll', assignee_type: 'callQueue' },
  { id: 'pn-cq-003', number: '03-6789-0003', display_name: 'ミズテック受電', type: 'toll', assignee_type: 'callQueue' },
  { id: 'pn-cq-003b', number: '0120-999-003', display_name: 'ミズテック フリーダイヤル', type: 'tollfree', assignee_type: 'callQueue' },
  { id: 'pn-cq-004', number: '03-6789-0004', display_name: 'リクモ架電', type: 'toll', assignee_type: 'callQueue' },
  // 自動応答番号
  { id: 'pn-ar-001', number: '03-5555-0000', display_name: 'Canvi代表番号', type: 'toll', assignee_type: 'autoReceptionist' },
  { id: 'pn-ar-002', number: '0120-999-000', display_name: 'Canvi フリーダイヤル', type: 'tollfree', assignee_type: 'autoReceptionist' },
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assigneeType = searchParams.get('assignee_type') as
      | 'user'
      | 'callQueue'
      | 'autoReceptionist'
      | 'unassigned'
      | null

    if (DEMO_MODE) {
      let data = [...DEMO_PHONE_NUMBERS]
      if (assigneeType && assigneeType !== 'unassigned') {
        data = data.filter((n) => n.assignee_type === assigneeType)
      }
      return NextResponse.json({
        total_records: data.length,
        phone_numbers: data,
        page_size: 30,
        next_page_token: '',
      })
    }

    const data = await zoomPhone.listPhoneNumbers(
      30,
      undefined,
      assigneeType || undefined
    )
    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/integrations/zoom/phone/numbers error:', error)
    return NextResponse.json({ error: '電話番号一覧の取得に失敗しました' }, { status: 500 })
  }
}
