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

    // ポータルページ: ロール未選択ならログインへ
    const portalPaths = [
      '/dashboard', '/staff', '/clients', '/contracts', '/projects',
      '/documents', '/shifts', '/reports', '/payments', '/retirement',
      '/ai', '/alerts', '/settings', '/accounts',
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

  const portalPaths = [
    '/dashboard', '/staff', '/contracts', '/projects',
    '/shifts', '/reports', '/payments', '/retirement',
    '/ai', '/alerts', '/settings',
  ]
  if (!user && portalPaths.some((p) => request.nextUrl.pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
