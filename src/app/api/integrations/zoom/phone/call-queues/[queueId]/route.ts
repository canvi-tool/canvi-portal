import { NextRequest, NextResponse } from 'next/server'
import * as zoomPhone from '@/lib/integrations/zoom-phone'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// デモ用コールキュー詳細
const DEMO_QUEUE_MAP: Record<string, zoomPhone.ZoomCallQueue> = {
  'cq-001': {
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
  'cq-002': {
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
  'cq-003': {
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
  'cq-004': {
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
}

interface RouteParams {
  params: Promise<{ queueId: string }>
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { queueId } = await params

    if (DEMO_MODE) {
      const queue = DEMO_QUEUE_MAP[queueId]
      if (!queue) {
        return NextResponse.json({ error: 'コールキューが見つかりません' }, { status: 404 })
      }
      return NextResponse.json(queue)
    }

    const queue = await zoomPhone.getCallQueue(queueId)
    return NextResponse.json(queue)
  } catch (error) {
    console.error('GET /api/integrations/zoom/phone/call-queues/[queueId] error:', error)
    return NextResponse.json({ error: 'コールキューの取得に失敗しました' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { queueId } = await params
    const body = await request.json()
    const { name, description, distribution_type, max_wait_time, status } =
      body as zoomPhone.UpdateCallQueueParams

    if (DEMO_MODE) {
      const queue = DEMO_QUEUE_MAP[queueId]
      if (!queue) {
        return NextResponse.json({ error: 'コールキューが見つかりません' }, { status: 404 })
      }
      return NextResponse.json({
        ...queue,
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(distribution_type !== undefined && { distribution_type }),
        ...(max_wait_time !== undefined && { max_wait_time }),
        ...(status !== undefined && { status }),
      })
    }

    await zoomPhone.updateCallQueue(queueId, {
      name,
      description,
      distribution_type,
      max_wait_time,
      status,
    })
    const updated = await zoomPhone.getCallQueue(queueId)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/integrations/zoom/phone/call-queues/[queueId] error:', error)
    return NextResponse.json({ error: 'コールキューの更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { queueId } = await params

    if (DEMO_MODE) {
      return NextResponse.json({ success: true })
    }

    await zoomPhone.deleteCallQueue(queueId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/integrations/zoom/phone/call-queues/[queueId] error:', error)
    return NextResponse.json({ error: 'コールキューの削除に失敗しました' }, { status: 500 })
  }
}
