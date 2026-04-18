// ============================================================
// GET /api/sso/launch?slug=<service_slug>
// Canviポータル認証済ユーザーに対し、指定サービス向けの短命JWTを発行し、
// そのサービスの /api/sso/callback?token=xxx にリダイレクトする。
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function base64UrlEncode(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function signJwt(payload: Record<string, unknown>, secret: string, expiresInSec: number): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + expiresInSec, iss: 'canvi-portal' }
  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const bodyB64 = base64UrlEncode(JSON.stringify(body))
  const signingInput = `${headerB64}.${bodyB64}`
  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest()
  return `${signingInput}.${base64UrlEncode(sig)}`
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }

  // Tolerate trailing whitespace/newlines that may have been copy-pasted into
  // the Vercel env var (root cause of a past invalid_token_bad_signature bug).
  const secret = (process.env.CANVI_SSO_SECRET ?? '').trim()
  if (!secret) {
    return NextResponse.json({ error: 'SSO not configured' }, { status: 500 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    // 未ログイン → ログイン画面へリダイレクト（戻りURLを保持）
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', `/api/sso/launch?slug=${slug}`)
    return NextResponse.redirect(loginUrl)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = request.headers.get('user-agent') || null

  // サービス情報取得
  const { data: service } = await sb
    .from('canvi_services')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (!service) {
    await sb.from('canvi_service_access_logs').insert({
      user_id: user.id,
      service_id: null,
      service_slug: slug,
      event: 'sso_error',
      user_email: user.email,
      user_name: null,
      ip_address: ipAddress,
      user_agent: userAgent,
      error_message: 'service not found',
      metadata: {},
    })
    return NextResponse.json({ error: 'service not found' }, { status: 404 })
  }

  // ユーザーに対する付与チェック
  const { data: access } = await sb
    .from('user_service_access')
    .select('service_id')
    .eq('user_id', user.id)
    .eq('service_id', service.id)
    .maybeSingle()
  if (!access) {
    // 付与なし → マイサービスに戻す
    await sb.from('canvi_service_access_logs').insert({
      user_id: user.id,
      service_id: service.id,
      service_slug: slug,
      event: 'access_denied',
      user_email: user.email,
      user_name: null,
      ip_address: ipAddress,
      user_agent: userAgent,
      error_message: null,
      metadata: {},
    })
    const apps = new URL('/apps', request.url)
    apps.searchParams.set('error', 'access_denied')
    apps.searchParams.set('service', slug)
    return NextResponse.redirect(apps)
  }

  // ユーザー情報を取得（display_name等）
  const { data: pubUser } = await sb
    .from('users')
    .select('display_name, email')
    .eq('id', user.id)
    .maybeSingle()

  const displayName = pubUser?.display_name ?? user.user_metadata?.display_name ?? ''
  const email = user.email ?? pubUser?.email ?? ''

  // JWT発行（5分有効）
  let token: string
  try {
    token = signJwt(
      {
        sub: user.id,
        email,
        name: displayName,
        service: slug,
        aud: slug,
      },
      secret,
      5 * 60,
    )
  } catch (err) {
    await sb.from('canvi_service_access_logs').insert({
      user_id: user.id,
      service_id: service.id,
      service_slug: slug,
      event: 'sso_error',
      user_email: email,
      user_name: displayName,
      ip_address: ipAddress,
      user_agent: userAgent,
      error_message: err instanceof Error ? err.message : 'jwt sign failed',
      metadata: {},
    })
    return NextResponse.json({ error: 'sso error' }, { status: 500 })
  }

  // SSO launch 成功ログ
  await sb.from('canvi_service_access_logs').insert({
    user_id: user.id,
    service_id: service.id,
    service_slug: slug,
    event: 'sso_launch',
    user_email: email,
    user_name: displayName,
    ip_address: ipAddress,
    user_agent: userAgent,
    error_message: null,
    metadata: {},
  })

  // サービスの /api/sso/callback にリダイレクト
  const callbackUrl = new URL('/api/sso/callback', service.url)
  callbackUrl.searchParams.set('token', token)
  return NextResponse.redirect(callbackUrl)
}
