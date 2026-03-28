/**
 * 外部サービス接続ヘルスチェック API
 * GET /api/integrations/health
 *
 * 各外部サービスの接続状態を確認し、ステータスを返す
 */

import { NextResponse } from 'next/server'

interface ServiceHealth {
  name: string
  status: 'connected' | 'not_configured' | 'error' | 'demo'
  message: string
  lastChecked: string
}

async function checkGoogleWorkspace(): Promise<ServiceHealth> {
  const name = 'Google Workspace'
  const now = new Date().toISOString()

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return { name, status: 'demo', message: 'デモモードで動作中', lastChecked: now }
  }

  const email = process.env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_WORKSPACE_PRIVATE_KEY
  const admin = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN

  if (!email || !key || !admin || !domain) {
    const missing = []
    if (!email) missing.push('SERVICE_ACCOUNT_EMAIL')
    if (!key) missing.push('PRIVATE_KEY')
    if (!admin) missing.push('ADMIN_EMAIL')
    if (!domain) missing.push('DOMAIN')
    return {
      name,
      status: 'not_configured',
      message: `未設定の環境変数: ${missing.join(', ')}`,
      lastChecked: now,
    }
  }

  try {
    const { listUsers } = await import('@/lib/integrations/google-workspace')
    await listUsers(domain)
    return { name, status: 'connected', message: '正常に接続されています', lastChecked: now }
  } catch (err) {
    return {
      name,
      status: 'error',
      message: err instanceof Error ? err.message : '接続エラー',
      lastChecked: now,
    }
  }
}

async function checkZoom(): Promise<ServiceHealth> {
  const name = 'Zoom'
  const now = new Date().toISOString()

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return { name, status: 'demo', message: 'デモモードで動作中', lastChecked: now }
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET

  if (!accountId || !clientId || !clientSecret) {
    const missing = []
    if (!accountId) missing.push('ACCOUNT_ID')
    if (!clientId) missing.push('CLIENT_ID')
    if (!clientSecret) missing.push('CLIENT_SECRET')
    return {
      name,
      status: 'not_configured',
      message: `未設定の環境変数: ${missing.join(', ')}`,
      lastChecked: now,
    }
  }

  try {
    const { getAccessToken } = await import('@/lib/integrations/zoom')
    await getAccessToken()
    return { name, status: 'connected', message: '正常に接続されています', lastChecked: now }
  } catch (err) {
    return {
      name,
      status: 'error',
      message: err instanceof Error ? err.message : '接続エラー',
      lastChecked: now,
    }
  }
}

async function checkZoomPhone(): Promise<ServiceHealth> {
  const name = 'Zoom Phone'
  const now = new Date().toISOString()

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return { name, status: 'demo', message: 'デモモードで動作中', lastChecked: now }
  }

  // Zoom Phone uses same credentials as Zoom
  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET

  if (!accountId || !clientId || !clientSecret) {
    return {
      name,
      status: 'not_configured',
      message: 'Zoom API認証情報が未設定です',
      lastChecked: now,
    }
  }

  try {
    const { listCallQueues } = await import('@/lib/integrations/zoom-phone')
    await listCallQueues(1)
    return { name, status: 'connected', message: '正常に接続されています', lastChecked: now }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '接続エラー'
    // Zoom Phone not enabled on account
    if (msg.includes('not enabled') || msg.includes('403') || msg.includes('Forbidden')) {
      return {
        name,
        status: 'error',
        message: 'Zoom Phoneライセンスが有効化されていません',
        lastChecked: now,
      }
    }
    return { name, status: 'error', message: msg, lastChecked: now }
  }
}

export async function GET() {
  const [googleWorkspace, zoom, zoomPhone] = await Promise.all([
    checkGoogleWorkspace(),
    checkZoom(),
    checkZoomPhone(),
  ])

  return NextResponse.json({
    services: [googleWorkspace, zoom, zoomPhone],
    checkedAt: new Date().toISOString(),
  })
}
