import { NextRequest, NextResponse } from 'next/server'
import * as zoomPhone from '@/lib/integrations/zoom-phone'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// デモ用コールキューデータ
const DEMO_CALL_QUEUES: zoomPhone.ZoomCallQueue[] = [
  {
    id: 'cq-001',
    name: 'AIアポブーストキュー',
    extension_number: '8001',
    description: 'AIアポブースト案件の架電キュー',
    status: 'active',
    site_id: 'site-tokyo-01',
    phone_numbers: [
      { id: 'pn-cq-001', number: '03-6789-0001', display_name: 'AIアポブースト代表', type: 'toll', assignee_type: 'callQueue' },
    ],
    members: [
      { id: 'zoom-user-001', email: 'k.sato@canvi.co.jp', name: '佐藤健太', extension_number: '1001', receive_call: true, status: 'available' },
      { id: 'zoom-user-002', email: 'm.tanaka@canvi.co.jp', name: '田中美咲', extension_number: '1002', receive_call: true, status: 'available' },
      { id: 'zoom-user-005', email: 'y.takahashi@canvi.co.jp', name: '高橋雄太', extension_number: '1005', receive_call: true, status: 'offline' },
    ],
    distribution_type: 'longest_idle',
    max_wait_time: 120,
    business_hours: {
      type: 'custom',
      timezone: 'Asia/Tokyo',
      schedule: [
        { weekday: 2, from: '09:00', to: '18:00' },
        { weekday: 3, from: '09:00', to: '18:00' },
        { weekday: 4, from: '09:00', to: '18:00' },
        { weekday: 5, from: '09:00', to: '18:00' },
        { weekday: 6, from: '09:00', to: '18:00' },
      ],
    },
  },
  {
    id: 'cq-002',
    name: 'WHITE営業代行キュー',
    extension_number: '8002',
    description: 'WHITE営業代行の受架電キュー',
    status: 'active',
    site_id: 'site-tokyo-01',
    phone_numbers: [
      { id: 'pn-cq-002', number: '03-6789-0002', display_name: 'WHITE営業代行', type: 'toll', assignee_type: 'callQueue' },
    ],
    members: [
      { id: 'zoom-user-003', email: 'i.suzuki@canvi.co.jp', name: '鈴木一郎', extension_number: '1003', receive_call: true, status: 'available' },
      { id: 'zoom-user-004', email: 'h.yamada@canvi.co.jp', name: '山田花子', extension_number: '1004', receive_call: true, status: 'available' },
    ],
    distribution_type: 'simultaneous',
    max_wait_time: 90,
    business_hours: {
      type: 'custom',
      timezone: 'Asia/Tokyo',
      schedule: [
        { weekday: 2, from: '09:00', to: '20:00' },
        { weekday: 3, from: '09:00', to: '20:00' },
        { weekday: 4, from: '09:00', to: '20:00' },
        { weekday: 5, from: '09:00', to: '20:00' },
        { weekday: 6, from: '09:00', to: '20:00' },
      ],
    },
  },
  {
    id: 'cq-003',
    name: 'ミズテック受電キュー',
    extension_number: '8003',
    description: 'ミズテック案件の受電対応キュー',
    status: 'active',
    site_id: 'site-tokyo-01',
    phone_numbers: [
      { id: 'pn-cq-003', number: '03-6789-0003', display_name: 'ミズテック受電', type: 'toll', assignee_type: 'callQueue' },
      { id: 'pn-cq-003b', number: '0120-999-003', display_name: 'ミズテック フリーダイヤル', type: 'tollfree', assignee_type: 'callQueue' },
    ],
    members: [
      { id: 'zoom-user-001', email: 'k.sato@canvi.co.jp', name: '佐藤健太', extension_number: '1001', receive_call: true, status: 'available' },
      { id: 'zoom-user-004', email: 'h.yamada@canvi.co.jp', name: '山田花子', extension_number: '1004', receive_call: true, status: 'available' },
      { id: 'zoom-user-005', email: 'y.takahashi@canvi.co.jp', name: '高橋雄太', extension_number: '1005', receive_call: false, status: 'offline' },
    ],
    distribution_type: 'rotating',
    max_wait_time: 60,
    business_hours: {
      type: 'custom',
      timezone: 'Asia/Tokyo',
      schedule: [
        { weekday: 2, from: '08:00', to: '21:00' },
        { weekday: 3, from: '08:00', to: '21:00' },
        { weekday: 4, from: '08:00', to: '21:00' },
        { weekday: 5, from: '08:00', to: '21:00' },
        { weekday: 6, from: '08:00', to: '21:00' },
        { weekday: 7, from: '10:00', to: '17:00' },
      ],
    },
  },
  {
    id: 'cq-004',
    name: 'リクモ架電キュー',
    extension_number: '8004',
    description: 'リクモ案件のアウトバウンド架電キュー',
    status: 'active',
    site_id: 'site-tokyo-01',
    phone_numbers: [
      { id: 'pn-cq-004', number: '03-6789-0004', display_name: 'リクモ架電', type: 'toll', assignee_type: 'callQueue' },
    ],
    members: [
      { id: 'zoom-user-002', email: 'm.tanaka@canvi.co.jp', name: '田中美咲', extension_number: '1002', receive_call: true, status: 'available' },
      { id: 'zoom-user-003', email: 'i.suzuki@canvi.co.jp', name: '鈴木一郎', extension_number: '1003', receive_call: true, status: 'available' },
      { id: 'zoom-user-005', email: 'y.takahashi@canvi.co.jp', name: '高橋雄太', extension_number: '1005', receive_call: true, status: 'available' },
    ],
    distribution_type: 'sequential',
    max_wait_time: 180,
    business_hours: {
      type: 'custom',
      timezone: 'Asia/Tokyo',
      schedule: [
        { weekday: 2, from: '10:00', to: '19:00' },
        { weekday: 3, from: '10:00', to: '19:00' },
        { weekday: 4, from: '10:00', to: '19:00' },
        { weekday: 5, from: '10:00', to: '19:00' },
        { weekday: 6, from: '10:00', to: '19:00' },
      ],
    },
  },
]

export async function GET() {
  try {
    if (DEMO_MODE) {
      return NextResponse.json({
        total_records: DEMO_CALL_QUEUES.length,
        call_queues: DEMO_CALL_QUEUES,
        page_size: 30,
        next_page_token: '',
      })
    }

    const data = await zoomPhone.listCallQueues()
    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/integrations/zoom/phone/call-queues error:', error)
    return NextResponse.json({ error: 'コールキュー一覧の取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, extension_number, description, site_id, distribution_type, max_wait_time } =
      body as zoomPhone.CreateCallQueueParams

    if (!name) {
      return NextResponse.json({ error: 'name は必須です' }, { status: 400 })
    }

    if (DEMO_MODE) {
      const newQueue: zoomPhone.ZoomCallQueue = {
        id: `cq-${Date.now()}`,
        name,
        extension_number: extension_number || '8099',
        description: description || '',
        status: 'active',
        site_id: site_id || 'site-tokyo-01',
        phone_numbers: [],
        members: [],
        distribution_type: distribution_type || 'simultaneous',
        max_wait_time: max_wait_time || 120,
        business_hours: {
          type: '24hours',
          timezone: 'Asia/Tokyo',
        },
      }
      return NextResponse.json(newQueue, { status: 201 })
    }

    const queue = await zoomPhone.createCallQueue({
      name,
      extension_number,
      description,
      site_id,
      distribution_type,
      max_wait_time,
    })
    return NextResponse.json(queue, { status: 201 })
  } catch (error) {
    console.error('POST /api/integrations/zoom/phone/call-queues error:', error)
    return NextResponse.json({ error: 'コールキューの作成に失敗しました' }, { status: 500 })
  }
}
