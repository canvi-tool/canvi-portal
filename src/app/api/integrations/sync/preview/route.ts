import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/rbac'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import * as gws from '@/lib/integrations/google-workspace'
import * as zoom from '@/lib/integrations/zoom'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// Demo Zoom users (same as zoom users route)
const DEMO_ZOOM_USERS: zoom.ZoomUser[] = [
  {
    id: 'zoom-user-001',
    email: 'k.sato@canvi.co.jp',
    first_name: '健太',
    last_name: '佐藤',
    display_name: '佐藤健太',
    type: 2,
    status: 'active',
    created_at: '2025-04-01T00:00:00Z',
    last_login_time: '2026-03-28T08:30:00Z',
  },
  {
    id: 'zoom-user-002',
    email: 'm.tanaka@canvi.co.jp',
    first_name: '美咲',
    last_name: '田中',
    display_name: '田中美咲',
    type: 2,
    status: 'active',
    created_at: '2025-04-01T00:00:00Z',
    last_login_time: '2026-03-28T09:00:00Z',
  },
  {
    id: 'zoom-user-003',
    email: 'i.suzuki@canvi.co.jp',
    first_name: '一郎',
    last_name: '鈴木',
    display_name: '鈴木一郎',
    type: 2,
    status: 'active',
    created_at: '2025-06-15T00:00:00Z',
    last_login_time: '2026-03-27T17:00:00Z',
  },
  {
    id: 'zoom-user-004',
    email: 'h.yamada@canvi.co.jp',
    first_name: '花子',
    last_name: '山田',
    display_name: '山田花子',
    type: 2,
    status: 'active',
    created_at: '2025-08-01T00:00:00Z',
    last_login_time: '2026-03-28T08:45:00Z',
  },
  {
    id: 'zoom-user-005',
    email: 'y.takahashi@canvi.co.jp',
    first_name: '雄太',
    last_name: '高橋',
    display_name: '高橋雄太',
    type: 2,
    status: 'active',
    created_at: '2025-10-01T00:00:00Z',
    last_login_time: '2026-03-28T09:15:00Z',
  },
  {
    id: 'zoom-user-006',
    email: 'a.nakamura@canvi.co.jp',
    first_name: '明',
    last_name: '中村',
    display_name: '中村明',
    type: 1,
    status: 'inactive',
    created_at: '2025-05-01T00:00:00Z',
    last_login_time: '2026-02-15T10:00:00Z',
  },
]

export interface SyncPreviewUser {
  name: string
  email: string
  provider: 'google_workspace' | 'zoom'
  external_id: string
  status: 'new' | 'exists'
}

export interface SyncPreviewResponse {
  users: SyncPreviewUser[]
  already_exists: number
  to_import: number
}

async function fetchGoogleWorkspaceUsers(): Promise<
  { name: string; email: string; external_id: string }[]
> {
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN || 'canvi.co.jp'
  const users = await gws.listUsers(domain)
  return users.map((u) => ({
    name: u.name.fullName,
    email: u.primaryEmail,
    external_id: u.id,
  }))
}

async function fetchZoomUsers(): Promise<
  { name: string; email: string; external_id: string }[]
> {
  if (DEMO_MODE) {
    return DEMO_ZOOM_USERS.map((u) => ({
      name: u.display_name,
      email: u.email,
      external_id: u.id,
    }))
  }

  const response = await zoom.listUsers(300, 1, 'active')
  return response.users.map((u) => ({
    name: u.display_name,
    email: u.email,
    external_id: u.id,
  }))
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const providersParam = searchParams.get('providers') || 'google_workspace,zoom'
    const providers = providersParam.split(',').map((p) => p.trim())

    // Fetch external users from requested providers
    const externalUsers: { name: string; email: string; external_id: string; provider: 'google_workspace' | 'zoom' }[] = []

    const fetchPromises: Promise<void>[] = []

    if (providers.includes('google_workspace')) {
      fetchPromises.push(
        fetchGoogleWorkspaceUsers().then((users) => {
          for (const u of users) {
            externalUsers.push({ ...u, provider: 'google_workspace' })
          }
        })
      )
    }

    if (providers.includes('zoom')) {
      fetchPromises.push(
        fetchZoomUsers().then((users) => {
          for (const u of users) {
            externalUsers.push({ ...u, provider: 'zoom' })
          }
        })
      )
    }

    await Promise.all(fetchPromises)

    // Get existing staff emails from the portal
    const supabase = await createServerSupabaseClient()
    const { data: existingStaff } = await supabase
      .from('staff')
      .select('email')

    const existingEmails = new Set(
      (existingStaff || []).map((s) => s.email?.toLowerCase()).filter(Boolean)
    )

    // Deduplicate by email (keep first occurrence per email)
    const seen = new Set<string>()
    const previewUsers: SyncPreviewUser[] = []

    for (const u of externalUsers) {
      const emailLower = u.email.toLowerCase()
      if (seen.has(emailLower)) continue
      seen.add(emailLower)

      previewUsers.push({
        name: u.name,
        email: u.email,
        provider: u.provider,
        external_id: u.external_id,
        status: existingEmails.has(emailLower) ? 'exists' : 'new',
      })
    }

    const alreadyExists = previewUsers.filter((u) => u.status === 'exists').length
    const toImport = previewUsers.filter((u) => u.status === 'new').length

    return NextResponse.json({
      users: previewUsers,
      already_exists: alreadyExists,
      to_import: toImport,
    } satisfies SyncPreviewResponse)
  } catch (err) {
    console.error('GET /api/integrations/sync/preview error:', err)
    return NextResponse.json(
      { error: '同期プレビューの取得に失敗しました' },
      { status: 500 }
    )
  }
}
