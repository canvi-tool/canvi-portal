import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export async function updateSession(request: NextRequest) {
  // デモモード
  if (DEMO_MODE) {
    const demoRole = request.cookies.get('demo_role')?.value

    // ログインページ: ロール未選択ならそのまま表示
    if (request.nextUrl.pathname === '/login') {
      if (demoRole) {
        // 既にロール選択済みならダッシュボードへ
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
      return NextResponse.next({ request })
    }

    // APIルートはミドルウェアでリダイレクトしない
    if (request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.next({ request })
    }

    // ポータルページ: ロール未選択ならログインへ
    const portalPaths = [
      '/dashboard', '/tutorial', '/staff', '/clients', '/contracts', '/projects',
      '/documents', '/invoices', '/shifts', '/leave', '/calendar', '/attendance', '/reports', '/payments', '/retirement',
      '/ai', '/alerts', '/settings',
    ]
    if (!demoRole && portalPaths.some((p) => request.nextUrl.pathname.startsWith(p))) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    return NextResponse.next({ request })
  }

  // 本番モード: Supabase認証
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/(portal)')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // APIルートはミドルウェアでリダイレクトしない（API側で認証チェックする）
  if (request.nextUrl.pathname.startsWith('/api')) {
    return supabaseResponse
  }

  const portalPaths = [
    '/dashboard', '/tutorial', '/staff', '/contracts', '/projects',
    '/documents', '/invoices', '/shifts', '/calendar', '/attendance', '/reports', '/payments', '/retirement',
    '/ai', '/alerts', '/settings',
  ]
  if (!user && portalPaths.some((p) => request.nextUrl.pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // /onboarding と /setup-password は認証不要（公開ページ）
  if (
    request.nextUrl.pathname.startsWith('/onboarding') ||
    request.nextUrl.pathname.startsWith('/setup-password')
  ) {
    return supabaseResponse
  }

  // 初回ログイン: パスワード未設定 or Google連携未完了 → セットアップ画面へ強制リダイレクト
  if (user && (user.user_metadata?.needs_password_setup || user.user_metadata?.needs_google_link)) {
    if (
      !request.nextUrl.pathname.startsWith('/setup-password') &&
      !request.nextUrl.pathname.startsWith('/api') &&
      !request.nextUrl.pathname.startsWith('/callback')
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/setup-password'
      return NextResponse.redirect(url)
    }
  }

  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // 認証関連ページはキャッシュ無効化（ブラウザバック時の古い状態防止）
  const noCachePaths = ['/login', '/callback', '/setup-password']
  if (noCachePaths.some((p) => request.nextUrl.pathname.startsWith(p))) {
    supabaseResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    supabaseResponse.headers.set('Pragma', 'no-cache')
  }

  return supabaseResponse
}
