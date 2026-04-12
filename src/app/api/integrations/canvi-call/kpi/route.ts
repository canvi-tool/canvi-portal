import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth/session'

// Proxy to canvi-call external API (server-side to keep API key secret)
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const portalProjectId = searchParams.get('project_id')

    if (!date) {
      return NextResponse.json({ error: 'date パラメータが必要です' }, { status: 400 })
    }

    const apiUrl = process.env.CANVI_CALL_API_URL
    const apiKey = process.env.CANVI_CALL_API_KEY

    if (!apiUrl || !apiKey) {
      return NextResponse.json(
        { error: 'テレアポくんAPI連携が設定されていません' },
        { status: 503 }
      )
    }

    let url = `${apiUrl}/api/external/daily-kpi?date=${encodeURIComponent(date)}&email=${encodeURIComponent(user.email)}`
    if (portalProjectId) url += `&portal_project_id=${encodeURIComponent(portalProjectId)}`

    const res = await fetch(url, {
      headers: { 'X-API-Key': apiKey },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err.error || 'テレアポくんからのデータ取得に失敗しました' },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('canvi-call KPI proxy error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
