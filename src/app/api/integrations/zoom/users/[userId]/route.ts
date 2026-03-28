import { NextRequest, NextResponse } from 'next/server'
import * as zoom from '@/lib/integrations/zoom'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const DEMO_USER: zoom.ZoomUser = {
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
}

interface RouteParams {
  params: Promise<{ userId: string }>
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await params

    if (DEMO_MODE) {
      return NextResponse.json({ ...DEMO_USER, id: userId })
    }

    const user = await zoom.getUser(userId)
    return NextResponse.json(user)
  } catch (error) {
    console.error('GET /api/integrations/zoom/users/[userId] error:', error)
    return NextResponse.json({ error: 'Zoomユーザーの取得に失敗しました' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await params
    const body = await request.json()
    const { status } = body as { status?: 'activate' | 'deactivate' }

    if (!status || !['activate', 'deactivate'].includes(status)) {
      return NextResponse.json(
        { error: 'status は "activate" または "deactivate" を指定してください' },
        { status: 400 }
      )
    }

    if (DEMO_MODE) {
      return NextResponse.json({
        ...DEMO_USER,
        id: userId,
        status: status === 'activate' ? 'active' : 'inactive',
      })
    }

    await zoom.updateUserStatus(userId, status)
    const updatedUser = await zoom.getUser(userId)
    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('PATCH /api/integrations/zoom/users/[userId] error:', error)
    return NextResponse.json({ error: 'Zoomユーザーのステータス更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await params

    if (DEMO_MODE) {
      return NextResponse.json({ success: true })
    }

    await zoom.deleteUser(userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/integrations/zoom/users/[userId] error:', error)
    return NextResponse.json({ error: 'Zoomユーザーの削除に失敗しました' }, { status: 500 })
  }
}
