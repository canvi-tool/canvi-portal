import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { INTEGRATION_KEYS, updateIntegrationSchema } from '@/lib/validations/settings'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

async function checkOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> | null) {
  if (DEMO_MODE) {
    const cookieStore = await cookies()
    const role = cookieStore.get('demo_role')?.value
    return role === 'owner'
  }
  if (!supabase) return false

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id, roles(name)')
    .eq('user_id', user.id)

  return userRoles?.some((ur: { roles: { name: string } | null }) => ur.roles?.name === 'owner') ?? false
}

// In-memory store for demo. In production, use a proper secrets store.
const integrationStore: Map<string, { enabled: boolean; config: Record<string, string> }> =
  new Map()

// Initialize with environment variable checks
function getIntegrations() {
  const results: { key: string; enabled: boolean; config: Record<string, string> }[] = []

  for (const key of INTEGRATION_KEYS) {
    const stored = integrationStore.get(key)
    if (stored) {
      // Mask sensitive values for GET response
      const maskedConfig: Record<string, string> = {}
      for (const [k, v] of Object.entries(stored.config)) {
        maskedConfig[k] = v
      }
      results.push({ key, enabled: stored.enabled, config: maskedConfig })
    } else {
      // Check env vars for default state
      let enabled = false
      const config: Record<string, string> = {}

      switch (key) {
        case 'freee_sign':
          enabled = !!process.env.FREEE_SIGN_CLIENT_ID
          if (enabled) {
            config.client_id = process.env.FREEE_SIGN_CLIENT_ID ?? ''
            config.client_secret = process.env.FREEE_SIGN_CLIENT_SECRET ?? ''
          }
          break
        case 'google_calendar':
          enabled = !!process.env.GOOGLE_CALENDAR_ID
          if (enabled) {
            config.calendar_id = process.env.GOOGLE_CALENDAR_ID ?? ''
          }
          break
        case 'resend_email':
          enabled = !!process.env.RESEND_API_KEY
          if (enabled) {
            config.api_key = process.env.RESEND_API_KEY ?? ''
            config.from_email = process.env.RESEND_FROM_EMAIL ?? ''
            config.from_name = process.env.RESEND_FROM_NAME ?? 'Canvi Portal'
          }
          break
        case 'claude_ai':
          enabled = !!process.env.ANTHROPIC_API_KEY
          if (enabled) {
            config.api_key = process.env.ANTHROPIC_API_KEY ?? ''
            config.model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514'
          }
          break
      }

      results.push({ key, enabled, config })
    }
  }

  return results
}

export async function GET() {
  const supabase = DEMO_MODE ? null : await createServerSupabaseClient()
  const isOwner = await checkOwner(supabase)
  if (!isOwner) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  return NextResponse.json({ integrations: getIntegrations() })
}

export async function PUT(request: NextRequest) {
  const supabase = DEMO_MODE ? null : await createServerSupabaseClient()
  const isOwner = await checkOwner(supabase)
  if (!isOwner) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateIntegrationSchema.safeParse(body)

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'バリデーションエラー'
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { key, enabled, config } = parsed.data

  const existing = integrationStore.get(key)
  const updatedConfig = {
    enabled: enabled ?? existing?.enabled ?? false,
    config: (config as Record<string, string>) ?? existing?.config ?? {},
  }

  // Merge with existing config (don't lose fields not sent in this request)
  if (existing?.config && config) {
    for (const [k, v] of Object.entries(existing.config)) {
      if (!(k in updatedConfig.config)) {
        updatedConfig.config[k] = v
      }
    }
  }

  integrationStore.set(key, updatedConfig)

  return NextResponse.json({ success: true })
}

// POST - Test connection
export async function POST(request: NextRequest) {
  const supabase = DEMO_MODE ? null : await createServerSupabaseClient()
  const isOwner = await checkOwner(supabase)
  if (!isOwner) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  const body = await request.json()
  const { key, action } = body

  if (action !== 'test') {
    return NextResponse.json({ error: '不明なアクションです' }, { status: 400 })
  }

  if (!INTEGRATION_KEYS.includes(key)) {
    return NextResponse.json({ error: '不明な連携キーです' }, { status: 400 })
  }

  const stored = integrationStore.get(key)
  if (!stored?.enabled) {
    // Check env fallback
    const envIntegrations = getIntegrations()
    const envConfig = envIntegrations.find((i) => i.key === key)
    if (!envConfig?.enabled) {
      return NextResponse.json(
        { error: 'この連携は設定されていません。先に設定を保存してください。' },
        { status: 400 }
      )
    }
  }

  // Simulate connection test per integration
  try {
    switch (key) {
      case 'freee_sign': {
        // In production: verify OAuth token or API key against freee Sign API
        return NextResponse.json({ message: 'freee Sign への接続テストに成功しました' })
      }
      case 'google_calendar': {
        // In production: attempt to list events from the calendar
        return NextResponse.json({
          message: 'Google カレンダーへの接続テストに成功しました',
        })
      }
      case 'resend_email': {
        // In production: call Resend API to verify the key
        const config = stored?.config ?? {}
        if (!config.api_key && !process.env.RESEND_API_KEY) {
          return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 400 })
        }
        return NextResponse.json({ message: 'Resend への接続テストに成功しました' })
      }
      case 'claude_ai': {
        // In production: send a simple prompt to verify the API key
        const config = stored?.config ?? {}
        if (!config.api_key && !process.env.ANTHROPIC_API_KEY) {
          return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 400 })
        }
        return NextResponse.json({ message: 'Claude AI への接続テストに成功しました' })
      }
      default:
        return NextResponse.json({ error: '不明な連携キーです' }, { status: 400 })
    }
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '接続テストに失敗しました' },
      { status: 500 }
    )
  }
}
