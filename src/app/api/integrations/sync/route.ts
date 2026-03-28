import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import * as gws from '@/lib/integrations/google-workspace'
import * as zoom from '@/lib/integrations/zoom'
import type { Json } from '@/lib/types/database'

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

interface ExternalUser {
  name: string
  email: string
  external_id: string
  provider: 'google_workspace' | 'zoom'
}

interface SyncDetail {
  email: string
  name: string
  provider: string
  action: 'imported' | 'skipped' | 'error'
  reason?: string
}

interface SyncResult {
  imported: number
  skipped: number
  errors: string[]
  details: SyncDetail[]
}

async function fetchGoogleWorkspaceUsers(): Promise<ExternalUser[]> {
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN || 'canvi.co.jp'
  const users = await gws.listUsers(domain)
  return users.map((u) => ({
    name: u.name.fullName,
    email: u.primaryEmail,
    external_id: u.id,
    provider: 'google_workspace' as const,
  }))
}

async function fetchZoomUsers(): Promise<ExternalUser[]> {
  if (DEMO_MODE) {
    return DEMO_ZOOM_USERS.map((u) => ({
      name: u.display_name,
      email: u.email,
      external_id: u.id,
      provider: 'zoom' as const,
    }))
  }

  const response = await zoom.listUsers(300, 1, 'active')
  return response.users.map((u) => ({
    name: u.display_name,
    email: u.email,
    external_id: u.id,
    provider: 'zoom' as const,
  }))
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin().catch(() => null)
    if (!admin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const providers: string[] = body.providers || ['google_workspace', 'zoom']

    // Fetch external users from requested providers
    const allExternalUsers: ExternalUser[] = []
    const fetchPromises: Promise<void>[] = []

    if (providers.includes('google_workspace')) {
      fetchPromises.push(
        fetchGoogleWorkspaceUsers()
          .then((users) => {
            allExternalUsers.push(...users)
          })
          .catch((err) => {
            console.error('Failed to fetch GWS users:', err)
          })
      )
    }

    if (providers.includes('zoom')) {
      fetchPromises.push(
        fetchZoomUsers()
          .then((users) => {
            allExternalUsers.push(...users)
          })
          .catch((err) => {
            console.error('Failed to fetch Zoom users:', err)
          })
      )
    }

    await Promise.all(fetchPromises)

    // Get existing staff emails
    const supabase = await createServerSupabaseClient()
    const { data: existingStaff } = await supabase
      .from('staff')
      .select('id, email')

    const existingEmailMap = new Map<string, string>()
    for (const s of existingStaff || []) {
      if (s.email) {
        existingEmailMap.set(s.email.toLowerCase(), s.id)
      }
    }

    // Deduplicate by email
    const seen = new Set<string>()
    const uniqueUsers: ExternalUser[] = []
    for (const u of allExternalUsers) {
      const emailLower = u.email.toLowerCase()
      if (seen.has(emailLower)) continue
      seen.add(emailLower)
      uniqueUsers.push(u)
    }

    const result: SyncResult = {
      imported: 0,
      skipped: 0,
      errors: [],
      details: [],
    }

    for (const extUser of uniqueUsers) {
      const emailLower = extUser.email.toLowerCase()
      const existingStaffId = existingEmailMap.get(emailLower)

      if (existingStaffId) {
        // User already exists as staff - just link external account if not linked yet
        result.skipped++
        result.details.push({
          email: extUser.email,
          name: extUser.name,
          provider: extUser.provider,
          action: 'skipped',
          reason: '既にスタッフとして登録済み',
        })

        // Still try to link the external account
        try {
          // staff_external_accounts table may not be in generated types yet
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: existingLink } = await (supabase as any)
            .from('staff_external_accounts')
            .select('id')
            .eq('staff_id', existingStaffId)
            .eq('provider', extUser.provider)
            .maybeSingle()

          if (!existingLink) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from('staff_external_accounts').insert({
              staff_id: existingStaffId,
              provider: extUser.provider,
              external_id: extUser.external_id,
              email: extUser.email,
              status: 'active',
              provisioned_at: new Date().toISOString(),
              metadata: {},
            })
          }
        } catch (linkErr) {
          // Non-critical - don't fail the whole sync
          console.error(`Failed to link external account for ${extUser.email}:`, linkErr)
        }

        continue
      }

      // Create new staff record
      try {
        const now = new Date().toISOString()
        const staffRecord = {
          full_name: extUser.name,
          full_name_kana: null as string | null,
          email: extUser.email,
          employment_type: 'employee' as const,
          status: 'active' as const,
          custom_fields: {
            imported_from: extUser.provider,
            imported_at: now,
          } as Json,
        }

        const { data: newStaff, error: staffError } = await supabase
          .from('staff')
          .insert(staffRecord)
          .select('id')
          .single()

        if (staffError || !newStaff) {
          throw new Error(staffError?.message || 'スタッフの作成に失敗しました')
        }

        // Link external account (table may not be in generated types yet)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('staff_external_accounts').insert({
          staff_id: newStaff.id,
          provider: extUser.provider,
          external_id: extUser.external_id,
          email: extUser.email,
          status: 'active',
          provisioned_at: now,
          metadata: {},
        })

        // Create audit log
        await supabase.from('audit_logs').insert({
          user_id: admin.id,
          action: 'create',
          resource: 'staff',
          resource_id: newStaff.id,
          new_data: {
            ...staffRecord,
            source: 'sync_import',
            provider: extUser.provider,
          } as unknown as Record<string, Json>,
        })

        result.imported++
        result.details.push({
          email: extUser.email,
          name: extUser.name,
          provider: extUser.provider,
          action: 'imported',
        })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        result.errors.push(`${extUser.email}: ${errMsg}`)
        result.details.push({
          email: extUser.email,
          name: extUser.name,
          provider: extUser.provider,
          action: 'error',
          reason: errMsg,
        })
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('POST /api/integrations/sync error:', err)
    return NextResponse.json(
      { error: '同期処理に失敗しました' },
      { status: 500 }
    )
  }
}
