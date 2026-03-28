import { NextRequest, NextResponse } from 'next/server'
import * as zoomPhone from '@/lib/integrations/zoom-phone'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// デモ用通話ログデータ
function generateDemoCallLogs(from: string, to: string, userId?: string): zoomPhone.ZoomCallLog[] {
  const allLogs: zoomPhone.ZoomCallLog[] = [
    // AIアポブースト関連の架電
    {
      id: 'cl-001',
      caller_number: '03-6789-0001',
      callee_number: '03-1234-5678',
      direction: 'outbound',
      duration: 185,
      result: 'answered',
      date_time: '2026-03-28T09:15:00Z',
      recording_url: 'https://zoom.us/rec/demo-001',
    },
    {
      id: 'cl-002',
      caller_number: '03-6789-0001',
      callee_number: '03-2345-6789',
      direction: 'outbound',
      duration: 0,
      result: 'busy',
      date_time: '2026-03-28T09:25:00Z',
    },
    {
      id: 'cl-003',
      caller_number: '03-6789-0001',
      callee_number: '03-3456-7890',
      direction: 'outbound',
      duration: 342,
      result: 'answered',
      date_time: '2026-03-28T09:32:00Z',
      recording_url: 'https://zoom.us/rec/demo-003',
    },
    {
      id: 'cl-004',
      caller_number: '03-6789-0001',
      callee_number: '03-4567-8901',
      direction: 'outbound',
      duration: 0,
      result: 'missed',
      date_time: '2026-03-28T09:45:00Z',
    },
    // WHITE営業代行関連
    {
      id: 'cl-005',
      caller_number: '03-5678-9012',
      callee_number: '03-6789-0002',
      direction: 'inbound',
      duration: 420,
      result: 'answered',
      date_time: '2026-03-28T10:00:00Z',
      recording_url: 'https://zoom.us/rec/demo-005',
    },
    {
      id: 'cl-006',
      caller_number: '03-6789-0002',
      callee_number: '03-6789-1234',
      direction: 'outbound',
      duration: 267,
      result: 'answered',
      date_time: '2026-03-28T10:30:00Z',
      recording_url: 'https://zoom.us/rec/demo-006',
    },
    // ミズテック受電関連
    {
      id: 'cl-007',
      caller_number: '03-7890-1234',
      callee_number: '03-6789-0003',
      direction: 'inbound',
      duration: 156,
      result: 'answered',
      date_time: '2026-03-28T08:10:00Z',
      recording_url: 'https://zoom.us/rec/demo-007',
    },
    {
      id: 'cl-008',
      caller_number: '03-8901-2345',
      callee_number: '0120-999-003',
      direction: 'inbound',
      duration: 0,
      result: 'voicemail',
      date_time: '2026-03-28T08:25:00Z',
    },
    {
      id: 'cl-009',
      caller_number: '03-9012-3456',
      callee_number: '03-6789-0003',
      direction: 'inbound',
      duration: 98,
      result: 'answered',
      date_time: '2026-03-28T09:05:00Z',
      recording_url: 'https://zoom.us/rec/demo-009',
    },
    // リクモ架電関連
    {
      id: 'cl-010',
      caller_number: '03-6789-0004',
      callee_number: '03-1111-2222',
      direction: 'outbound',
      duration: 215,
      result: 'answered',
      date_time: '2026-03-28T10:05:00Z',
      recording_url: 'https://zoom.us/rec/demo-010',
    },
    {
      id: 'cl-011',
      caller_number: '03-6789-0004',
      callee_number: '03-2222-3333',
      direction: 'outbound',
      duration: 0,
      result: 'missed',
      date_time: '2026-03-28T10:15:00Z',
    },
    {
      id: 'cl-012',
      caller_number: '03-6789-0004',
      callee_number: '03-3333-4444',
      direction: 'outbound',
      duration: 478,
      result: 'answered',
      date_time: '2026-03-28T10:25:00Z',
      recording_url: 'https://zoom.us/rec/demo-012',
    },
    // 個人直通番号への着信
    {
      id: 'cl-013',
      caller_number: '03-4444-5555',
      callee_number: '03-5555-0101',
      direction: 'inbound',
      duration: 312,
      result: 'answered',
      date_time: '2026-03-28T11:00:00Z',
    },
    {
      id: 'cl-014',
      caller_number: '03-5555-6666',
      callee_number: '03-5555-0102',
      direction: 'inbound',
      duration: 0,
      result: 'missed',
      date_time: '2026-03-28T11:15:00Z',
    },
    // 前日のログ
    {
      id: 'cl-015',
      caller_number: '03-6789-0001',
      callee_number: '03-6666-7777',
      direction: 'outbound',
      duration: 540,
      result: 'answered',
      date_time: '2026-03-27T14:00:00Z',
      recording_url: 'https://zoom.us/rec/demo-015',
    },
    {
      id: 'cl-016',
      caller_number: '03-7777-8888',
      callee_number: '03-6789-0003',
      direction: 'inbound',
      duration: 201,
      result: 'answered',
      date_time: '2026-03-27T15:30:00Z',
      recording_url: 'https://zoom.us/rec/demo-016',
    },
    {
      id: 'cl-017',
      caller_number: '03-6789-0004',
      callee_number: '03-8888-9999',
      direction: 'outbound',
      duration: 0,
      result: 'busy',
      date_time: '2026-03-27T16:00:00Z',
    },
    {
      id: 'cl-018',
      caller_number: '03-6789-0002',
      callee_number: '03-9999-0000',
      direction: 'outbound',
      duration: 387,
      result: 'answered',
      date_time: '2026-03-27T16:45:00Z',
      recording_url: 'https://zoom.us/rec/demo-018',
    },
  ]

  // ユーザー別の番号マッピング（userId指定時のフィルタ用）
  const userNumberMap: Record<string, string[]> = {
    'zoom-user-001': ['03-5555-0101'],
    'zoom-user-002': ['03-5555-0102'],
    'zoom-user-003': ['03-5555-0103'],
    'zoom-user-004': ['03-5555-0104'],
    'zoom-user-005': ['03-5555-0105'],
  }

  let filtered = allLogs.filter((log) => {
    const logDate = log.date_time.split('T')[0]
    return logDate >= from && logDate <= to
  })

  if (userId && userNumberMap[userId]) {
    const userNumbers = userNumberMap[userId]
    filtered = filtered.filter(
      (log) =>
        userNumbers.includes(log.caller_number) ||
        userNumbers.includes(log.callee_number)
    )
  }

  return filtered.sort(
    (a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime()
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const userId = searchParams.get('user_id')

    if (!from || !to) {
      return NextResponse.json(
        { error: 'from と to クエリパラメータは必須です（YYYY-MM-DD形式）' },
        { status: 400 }
      )
    }

    if (DEMO_MODE) {
      const logs = generateDemoCallLogs(from, to, userId || undefined)
      return NextResponse.json({
        total_records: logs.length,
        call_logs: logs,
        page_size: 30,
        next_page_token: '',
      })
    }

    const data = await zoomPhone.getCallLogs(from, to, userId || undefined)
    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/integrations/zoom/phone/call-logs error:', error)
    return NextResponse.json({ error: '通話ログの取得に失敗しました' }, { status: 500 })
  }
}
