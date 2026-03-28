import { NextRequest, NextResponse } from 'next/server'
import * as zoom from '@/lib/integrations/zoom'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// デモ用Zoomユーザーデータ
const DEMO_ZOOM_USERS: zoom.ZoomUser[] = [
  {
    id: 'zoom-user-001',
    email: 'k.sato@canvi.co.jp',
    first_name: '健太',
    last_name: '佐藤',
    display_name: '佐藤健太',
    type: 2,
    status: 'active',
    created_at: '2025-04-01T00:00:00Z',
    last_login_time: '2026-03-28T08:30:00Z',
    phone_numbers: [
      { id: 'pn-001', number: '03-5555-0101', display_name: '佐藤健太 直通', type: 'toll', assignee_type: 'user' },
    ],
  },
  {
    id: 'zoom-user-002',
    email: 'm.tanaka@canvi.co.jp',
    first_name: '美咲',
    last_name: '田中',
    display_name: '田中美咲',
    type: 2,
    status: 'active',
    created_at: '2025-04-01T00:00:00Z',
    last_login_time: '2026-03-28T09:00:00Z',
    phone_numbers: [
      { id: 'pn-002', number: '03-5555-0102', display_name: '田中美咲 直通', type: 'toll', assignee_type: 'user' },
    ],
  },
  {
    id: 'zoom-user-003',
    email: 'i.suzuki@canvi.co.jp',
    first_name: '一郎',
    last_name: '鈴木',
    display_name: '鈴木一郎',
    type: 2,
    status: 'active',
    created_at: '2025-06-15T00:00:00Z',
    last_login_time: '2026-03-27T17:00:00Z',
    phone_numbers: [
      { id: 'pn-003', number: '03-5555-0103', display_name: '鈴木一郎 直通', type: 'toll', assignee_type: 'user' },
    ],
  },
  {
    id: 'zoom-user-004',
    email: 'h.yamada@canvi.co.jp',
    first_name: '花子',
    last_name: '山田',
    display_name: '山田花子',
    type: 2,
    status: 'active',
    created_at: '2025-08-01T00:00:00Z',
    last_login_time: '2026-03-28T08:45:00Z',
    phone_numbers: [
      { id: 'pn-004', number: '03-5555-0104', display_name: '山田花子 直通', type: 'toll', assignee_type: 'user' },
    ],
  },
  {
    id: 'zoom-user-005',
    email: 'y.takahashi@canvi.co.jp',
    first_name: '雄太',
    last_name: '高橋',
    display_name: '高橋雄太',
    type: 2,
    status: 'active',
    created_at: '2025-10-01T00:00:00Z',
    last_login_time: '2026-03-28T09:15:00Z',
    phone_numbers: [
      { id: 'pn-005', number: '03-5555-0105', display_name: '高橋雄太 直通', type: 'toll', assignee_type: 'user' },
    ],
  },
  {
    id: 'zoom-user-006',
    email: 'a.nakamura@canvi.co.jp',
    first_name: '明',
    last_name: '中村',
    display_name: '中村明',
    type: 1,
    status: 'inactive',
    created_at: '2025-05-01T00:00:00Z',
    last_login_time: '2026-02-15T10:00:00Z',
    phone_numbers: [],
  },
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as 'active' | 'inactive' | 'pending' | null
    const pageSize = parseInt(searchParams.get('page_size') || '30', 10)
    const pageNumber = parseInt(searchParams.get('page_number') || '1', 10)

    if (DEMO_MODE) {
      let data = [...DEMO_ZOOM_USERS]
      if (status) {
        data = data.filter((u) => u.status === status)
      }
      const start = (pageNumber - 1) * pageSize
      const paged = data.slice(start, start + pageSize)
      return NextResponse.json({
        page_count: Math.ceil(data.length / pageSize),
        page_number: pageNumber,
        page_size: pageSize,
        total_records: data.length,
        users: paged,
      })
    }

    const data = await zoom.listUsers(pageSize, pageNumber, status || 'active')
    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/integrations/zoom/users error:', error)
    return NextResponse.json({ error: 'Zoomユーザー一覧の取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { email, first_name, last_name, type } = body as zoom.CreateZoomUserParams
    if (!email || !first_name || !last_name) {
      return NextResponse.json(
        { error: 'email, first_name, last_name は必須です' },
        { status: 400 }
      )
    }

    if (DEMO_MODE) {
      const newUser: zoom.ZoomUser = {
        id: `zoom-user-${Date.now()}`,
        email,
        first_name,
        last_name,
        display_name: `${last_name}${first_name}`,
        type: type ?? 1,
        status: 'pending',
        created_at: new Date().toISOString(),
        last_login_time: null,
        phone_numbers: [],
      }
      return NextResponse.json(newUser, { status: 201 })
    }

    const user = await zoom.createUser({ email, first_name, last_name, type })
    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('POST /api/integrations/zoom/users error:', error)
    return NextResponse.json({ error: 'Zoomユーザーの作成に失敗しました' }, { status: 500 })
  }
}
