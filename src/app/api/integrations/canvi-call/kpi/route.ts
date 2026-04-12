export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/rbac'

// Proxy to canvi-call external API (server-side to keep API key secret)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const portalProjectId = searchParams.get('project_id')

    if (!date) {
      return NextResponse.json({ error: 'date パラメータが必要です' }, { status: 400 })
    }

    const apiUrl = process.env.CANVI_CALL_API_URL?.trim()
    const apiKey = process.env.CANVI_CALL_API_KEY?.trim()

    if (!apiUrl || !apiKey) {
      return NextResponse.json(
        { error: 'テレアポくんAPI連携が設定されていません' },
        { status: 503 }
      )
    }

    let url = `${apiUrl}/api/external/daily-kpi?date=${encodeURIComponent(date)}&email=${encodeURIComponent(user.email)}`
    if (portalProjectId) url += `&portal_project_id=${encodeURIComponent(portalProjectId)}`

    console.log('[canvi-call KPI] Request URL:', url)
    console.log('[canvi-call KPI] email:', user.email, 'date:', date, 'portalProjectId:', portalProjectId)

    const res = await fetch(url, {
      headers: { 'X-API-Key': apiKey },
      cache: 'no-store',
    })

    const responseText = await res.text()
    console.log('[canvi-call KPI] Response status:', res.status, 'body:', responseText.substring(0, 500))

    if (!res.ok) {
      const err = (() => { try { return JSON.parse(responseText) } catch { return {} } })()
      return NextResponse.json(
        { error: err.error || 'テレアポくんからのデータ取得に失敗しました' },
        { status: res.status }
      )
    }

    const data = JSON.parse(responseText)
    return NextResponse.json(data)
  } catch (error) {
    console.error('canvi-call KPI proxy error:', error)
    return NextResponse.json(
      { error: `サーバーエラー: ${error instanceof Error ? error.message : 'unknown'}` },
      { status: 500 }
    )
  }
}
