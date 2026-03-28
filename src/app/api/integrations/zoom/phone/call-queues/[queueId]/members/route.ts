import { NextRequest, NextResponse } from 'next/server'
import * as zoomPhone from '@/lib/integrations/zoom-phone'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// デモ用キューメンバーデータ（キューID別）
const DEMO_QUEUE_MEMBERS: Record<string, zoomPhone.ZoomCallQueueMember[]> = {
  'cq-001': [
    { id: 'zoom-user-001', email: 'k.sato@canvi.co.jp', name: '佐藤健太', extension_number: '1001', receive_call: true, status: 'available' },
    { id: 'zoom-user-002', email: 'm.tanaka@canvi.co.jp', name: '田中美咲', extension_number: '1002', receive_call: true, status: 'available' },
    { id: 'zoom-user-005', email: 'y.takahashi@canvi.co.jp', name: '高橋雄太', extension_number: '1005', receive_call: true, status: 'offline' },
  ],
  'cq-002': [
    { id: 'zoom-user-003', email: 'i.suzuki@canvi.co.jp', name: '鈴木一郎', extension_number: '1003', receive_call: true, status: 'available' },
    { id: 'zoom-user-004', email: 'h.yamada@canvi.co.jp', name: '山田花子', extension_number: '1004', receive_call: true, status: 'available' },
  ],
  'cq-003': [
    { id: 'zoom-user-001', email: 'k.sato@canvi.co.jp', name: '佐藤健太', extension_number: '1001', receive_call: true, status: 'available' },
    { id: 'zoom-user-004', email: 'h.yamada@canvi.co.jp', name: '山田花子', extension_number: '1004', receive_call: true, status: 'available' },
    { id: 'zoom-user-005', email: 'y.takahashi@canvi.co.jp', name: '高橋雄太', extension_number: '1005', receive_call: false, status: 'offline' },
  ],
  'cq-004': [
    { id: 'zoom-user-002', email: 'm.tanaka@canvi.co.jp', name: '田中美咲', extension_number: '1002', receive_call: true, status: 'available' },
    { id: 'zoom-user-003', email: 'i.suzuki@canvi.co.jp', name: '鈴木一郎', extension_number: '1003', receive_call: true, status: 'available' },
    { id: 'zoom-user-005', email: 'y.takahashi@canvi.co.jp', name: '高橋雄太', extension_number: '1005', receive_call: true, status: 'available' },
  ],
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
      const members = DEMO_QUEUE_MEMBERS[queueId] || []
      return NextResponse.json({
        total_records: members.length,
        members,
        page_size: 30,
        next_page_token: '',
      })
    }

    const data = await zoomPhone.listQueueMembers(queueId)
    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/integrations/zoom/phone/call-queues/[queueId]/members error:', error)
    return NextResponse.json({ error: 'キューメンバーの取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { queueId } = await params
    const body = await request.json()
    const { members } = body as { members: zoomPhone.CallQueueMemberParams[] }

    if (!members || !Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { error: 'members 配列は必須です（1件以上）' },
        { status: 400 }
      )
    }

    if (DEMO_MODE) {
      // デモ用の追加後メンバー名マップ
      const nameMap: Record<string, { email: string; name: string; ext: string }> = {
        'zoom-user-001': { email: 'k.sato@canvi.co.jp', name: '佐藤健太', ext: '1001' },
        'zoom-user-002': { email: 'm.tanaka@canvi.co.jp', name: '田中美咲', ext: '1002' },
        'zoom-user-003': { email: 'i.suzuki@canvi.co.jp', name: '鈴木一郎', ext: '1003' },
        'zoom-user-004': { email: 'h.yamada@canvi.co.jp', name: '山田花子', ext: '1004' },
        'zoom-user-005': { email: 'y.takahashi@canvi.co.jp', name: '高橋雄太', ext: '1005' },
      }

      const addedMembers = members.map((m) => {
        const info = nameMap[m.id] || { email: `${m.id}@canvi.co.jp`, name: m.id, ext: '9999' }
        return {
          id: m.id,
          email: info.email,
          name: info.name,
          extension_number: info.ext,
          receive_call: m.receive_call ?? true,
          status: 'available' as const,
        }
      })

      return NextResponse.json({ added: addedMembers }, { status: 201 })
    }

    await zoomPhone.addQueueMembers(queueId, members)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/integrations/zoom/phone/call-queues/[queueId]/members error:', error)
    return NextResponse.json({ error: 'メンバーの追加に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { queueId } = await params
    const { searchParams } = new URL(request.url)
    const memberIds = searchParams.get('member_ids')

    if (!memberIds) {
      return NextResponse.json(
        { error: 'member_ids クエリパラメータは必須です（カンマ区切り）' },
        { status: 400 }
      )
    }

    const ids = memberIds.split(',').map((id) => id.trim()).filter(Boolean)
    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'member_ids に有効なIDが含まれていません' },
        { status: 400 }
      )
    }

    if (DEMO_MODE) {
      return NextResponse.json({ success: true, removed: ids })
    }

    await zoomPhone.removeQueueMembers(queueId, ids)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/integrations/zoom/phone/call-queues/[queueId]/members error:', error)
    return NextResponse.json({ error: 'メンバーの削除に失敗しました' }, { status: 500 })
  }
}
