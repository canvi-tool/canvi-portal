// ============================================================
// GET  /api/super-admin/tenants           一覧取得
// POST /api/super-admin/tenants           新規作成 + 各サービスへ propagation
//
// アクセス可能: yuji.okabayashi@canvi.co.jp / tsutomu.hokugo@canvi.co.jp のみ
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/rbac'
import { requireSuperAdmin } from '@/lib/auth/super-admin'
import { ALL_SERVICES, propagateTenant, type ServiceKey } from '@/lib/tenant-sync'

export const dynamic = 'force-dynamic'

const servicesSchema = z.array(z.enum(ALL_SERVICES as [ServiceKey, ...ServiceKey[]]))

const createSchema = z.object({
  canonical_id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alnum + hyphen'),
  contact_email: z.string().email().nullable().optional(),
  status: z.enum(['active', 'suspended', 'deleted']).default('active'),
  enabled_services: servicesSchema.default([]),
})

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser()
  const guard = requireSuperAdmin(user)
  if (guard) return guard

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any
  const { data, error } = await sb
    .from('master_tenants')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ tenants: data ?? [] })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  const guard = requireSuperAdmin(user)
  if (guard) return guard

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any

  const payload = {
    canonical_id: parsed.data.canonical_id ?? crypto.randomUUID(),
    name: parsed.data.name,
    slug: parsed.data.slug,
    contact_email: parsed.data.contact_email ?? null,
    status: parsed.data.status,
    enabled_services: parsed.data.enabled_services,
  }

  const { data, error } = await sb
    .from('master_tenants')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const syncResults = await propagateTenant(
    {
      canonical_id: data.canonical_id,
      name: data.name,
      slug: data.slug,
      contact_email: data.contact_email,
      status: data.status,
    },
    payload.enabled_services as ServiceKey[],
  )

  return NextResponse.json({ tenant: data, sync: syncResults }, { status: 201 })
}
