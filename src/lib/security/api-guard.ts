import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, type UserWithRole, type RoleName, hasRole } from '@/lib/auth/rbac'

interface ApiGuardOptions {
  requiredRole?: RoleName
  allowUnauthenticated?: boolean
}

type AuthenticatedHandler = (
  request: NextRequest,
  context: { user: UserWithRole; params?: Record<string, string> }
) => Promise<NextResponse>

/**
 * API route guard - wraps handlers with auth, role checks, and error handling
 * Usage:
 *   export const GET = apiGuard(async (req, { user }) => { ... })
 *   export const POST = apiGuard(async (req, { user }) => { ... }, { requiredRole: 'admin' })
 */
export function apiGuard(handler: AuthenticatedHandler, options?: ApiGuardOptions) {
  return async (request: NextRequest, routeContext?: { params?: Promise<Record<string, string>> }) => {
    try {
      // Auth check
      if (!options?.allowUnauthenticated) {
        const user = await getCurrentUser()
        if (!user) {
          return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
        }

        // Role check
        if (options?.requiredRole && !hasRole(user, options.requiredRole)) {
          return NextResponse.json({ error: '権限が不足しています' }, { status: 403 })
        }

        const params = routeContext?.params ? await routeContext.params : undefined
        return await handler(request, { user, params })
      }

      const user = await getCurrentUser()
      const params = routeContext?.params ? await routeContext.params : undefined
      return await handler(request, { user: user!, params })
    } catch (error) {
      console.error(`API Error [${request.method} ${request.nextUrl.pathname}]:`, error)
      return NextResponse.json(
        { error: 'サーバーエラーが発生しました' },
        { status: 500 }
      )
    }
  }
}
